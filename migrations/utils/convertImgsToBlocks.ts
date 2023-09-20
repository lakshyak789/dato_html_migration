import {
  buildBlockRecord,
  Client,
  SimpleSchemaTypes,
} from "@datocms/cli/lib/cma-client-node";
import { visit, find } from "unist-utils-core";
import {
  HastNode,
  HastElementNode,
  CreateNodeFunction,
  Context,
} from "datocms-html-to-structured-text";
import { Options } from "datocms-html-to-structured-text";
import findOrCreateUploadWithUrl from "./findOrCreateUploadWithUrl";
import urlParser from "js-video-url-parser";
export default function convertImgsToBlocks(
  client: Client,
  modelIds: Record<string, SimpleSchemaTypes.ItemType>
): Options {
  return {
    preprocess: (tree: HastNode) => {
      const liftedImages = new WeakSet();

      const body = find(
        tree,
        (node: HastNode) =>
          (node.type === "element" && node.tagName === "body") ||
          node.type === "root"
      );

      visit<HastNode, HastElementNode & { children: HastNode[] }>(
        body,
        (node, index, parents) => {
          if (
            node.type !== "element" ||
            (node.tagName !== "iframe" &&
              (node.tagName !== "img" &&
              node.tagName !== "a" &&
              node.tagName !== "p" &&
              node.tagName !== "code") ||
            liftedImages.has(node) ||
            parents.length === 1
          )) {
            return;
          }

          if (node.tagName === "p" && node.type === "element") {
            if (
              !node.children ||
              node.children.length === 0 ||
              node.children[0].type !== "text"
            ) {
              return;
            }
            let child = node.children[0];
            if (!child.value) {
              return;
            }

            if (
              child.value.includes("[pullquote]") ||
              child.value.includes("[SadhguruSignature") ||
              child.value.includes("[ SadhguruSignature") ||
              child.value.includes("[/button]")
            ) {
              node.tagName = "code";
              return index;
            } else {
              return;
            }
          }
          else if (
            node.tagName === "a" &&
            !node.children
          ) {
            console.log("ignored a node = " + JSON.stringify(node));
            return;
          }
          else if (
            node.tagName === "a" &&
            node.children &&
            node.children.length > 0 &&
            node.properties &&
            node.children[0].type === "element" &&
            node.children[0].tagName === "img" &&
            node.children[0].properties
          ) {
            console.log("lifted a node = " + JSON.stringify(node));
            node.tagName = "anchorbanner"
            node.children[0].tagName = "banner"
            liftedImages.add(node);
          }
          // throw new Error("halt")
          const imgParent = parents[parents.length - 1];
          imgParent.children.splice(index, 1);

          let i = parents.length;
          let splitChildrenIndex = index;
          let childrenAfterSplitPoint: HastNode[] = [];

          while (--i > 0) {
            const parent = parents[i];
            const parentsParent = parents[i - 1];

            childrenAfterSplitPoint =
              parent.children.splice(splitChildrenIndex);
            splitChildrenIndex = parentsParent.children.indexOf(parent);

            let nodeInserted = false;

            if (i === 1) {
              splitChildrenIndex += 1;
              parentsParent.children.splice(splitChildrenIndex, 0, node);
              liftedImages.add(node);

              nodeInserted = true;
            }

            splitChildrenIndex += 1;

            if (childrenAfterSplitPoint.length > 0) {
              parentsParent.children.splice(splitChildrenIndex, 0, {
                ...parent,
                children: childrenAfterSplitPoint,
              });
            }

            if (parent.children.length === 0) {
              splitChildrenIndex -= 1;
              parentsParent.children.splice(
                nodeInserted ? splitChildrenIndex - 1 : splitChildrenIndex,
                1
              );
            }
          }
        }
      );
      // console.log("liftedImages JSON = " + JSON.stringify(liftedImages))
      // console.log("liftedImages = " + liftedImages)
    },
    // now that images are top-level, convert them into `block` dast nodes
    handlers: {
      anchorbanner: async (
        createNode: CreateNodeFunction,
        node: HastNode,
        _context: Context
      ) => {

        console.log("aaa node = " + JSON.stringify(node));

        if (node.type !== "element" || !node.properties || !node.children || node.children.length === 0) {
          console.log("handler ignored a node 1 = " + JSON.stringify(node));
          return;
        }
        // return if anchor tag doesn't have any image.
        if (node.children &&
          node.properties &&
          (node.children[0].type !== "element" ||
            node.children[0].tagName !== "banner")
        ) {
          console.log("handler ignored a node 2 = " + JSON.stringify(node));
          return;
        }
        // console.log( "a node = " + node)
        console.log("a node = " + JSON.stringify(node));

        const { href: url01 } = node.properties;
        console.log("href is = " + url01);
        let upload: any

        if (
          node.tagName === "anchorbanner" &&
          node.children &&
          node.children.length > 0 &&
          node.properties &&
          node.children[0].type === "element" &&
          node.children[0].tagName === "banner" &&
          node.children[0].properties
        ) {
          const { src: url } = node.children[0].properties;
          // url is image property. so unable to take it from <a>
          upload = await findOrCreateUploadWithUrl(client, url);
          console.log(" matched node is = " + JSON.stringify(node));
          console.log(" src is = " + url);
        }

        return createNode("block", {
          item: buildBlockRecord({
            item_type: { id: modelIds.ad_image_banner.id, type: "item_type" },
            image: {
              upload_id: upload.id,
            },
            link_url: url01
          }),
        });
      },
      img: async (
        createNode: CreateNodeFunction,
        node: HastNode,
        _context: Context
      ) => {
        if (node.type !== "element" || !node.properties) {
          return;
        }

        console.log("img node = " + JSON.stringify(node));

        const { src: url } = node.properties;
        const upload = await findOrCreateUploadWithUrl(client, url);

        return createNode("block", {
          item: buildBlockRecord({
            item_type: { id: modelIds.image_block.id, type: "item_type" },
            image: {
              upload_id: upload.id,
            },
          }),
        });
      },
      iframe: async (
        createNode: CreateNodeFunction,
        node: HastNode,
        _context: Context
      ) => {
        if (node.type !== "element" || !node.properties) {
          return;
        }

        const { src } = node.properties;
        const details: any = urlParser.parse(src);
        let video_thumbnail,
          video_title = "unknown";
        if (details.provider == "youtube") {
          video_thumbnail = `https://img.youtube.com/vi/${details.id}/0.jpg`;
        } else if (details.provider == "vimeo") {
          video_thumbnail = `https://vumbnail.com/${details.id}.jpg`;
        }
        return createNode("block", {
          item: buildBlockRecord({
            item_type: { id: modelIds.media_embed_v2.id, type: "item_type" },
            video: {
              url: src,
              width: 200,
              height: 113,
              provider: details.provider,
              provider_uid: details.id,
              thumbnail_url: video_thumbnail,
              title: video_title,
            },
          }),
        });
      },
      code: async (
        createNode: CreateNodeFunction,
        node: HastNode,
        _context: Context
      ) => {
        let condition = "";
        if (node.type !== "element" || !node.children) {
          return;
        }
        if (
          node.type === "element" &&
          node.children &&
          node.children.length > 0 &&
          node.children[0].type === "text"
        ) {
          let child = node.children[0];
          if (!child.value) {
            return;
          }

          if (
            child.value.includes("[pullquote]") &&
            child.value.includes("[/pullquote]")
          ) {
            condition = "pullquote";
          } else if (
            child.value.includes("[SadhguruSignature") ||
            child.value.includes("[ SadhguruSignature")
          ) {
            condition = "sadhguru_signature_love_grace";
          } else if (child.value.includes("[/button]")) {
            condition = "simple_button";
          } else {
            condition = "";
          }
        }
        if (!node.children[0]) {
          return;
        }
        if (node.children[0].type !== "text") {
          return;
        }
        let child = node.children[0];
        if (!child || !child.value) {
          return;
        }

        switch (condition) {
          case "simple_button":
            console.log("node in simple_button", node);
            let regex = /(?:https?|ftp):\/\/[\n\S]+/g;

            let matches = child.value.match(regex);
            if (!matches) return;
            let url = matches[0].replace(/(^\.+|\]+$)/gm, "");
            url = url.replace('^"|"$', "");
            let button_text = child.value.substring(
              child.value.indexOf("]") + 1,
              child.value.indexOf("[/button]")
            );

            return createNode("block", {
              item: buildBlockRecord({
                item_type: { id: modelIds.simple_button.id, type: "item_type" },
                button_text: button_text,
                link_url: url,
              }),
            });
          case "add_image_banner":
            return createNode("block", {
              item: buildBlockRecord({
                item_type: {
                  id: modelIds.add_image_banner.id,
                  type: "item_type",
                },
                url: {},
              }),
            });

          case "newsletter_block":
            return createNode("block", {
              item: buildBlockRecord({
                item_type: {
                  id: modelIds.newsletter_block.id,
                  type: "item_type",
                },
                url: {},
              }),
            });

          case "sadhguru_signature_love_grace":
            return createNode("block", {
              item: buildBlockRecord({
                item_type: {
                  id: modelIds.sadhguru_signature_love_grace.id,
                  type: "item_type",
                },

                text: "147374130",
              }),
            });

          default:
            return createNode("paragraph", {
              type: "paragraph",
              children: [
                {
                  type: "span",
                  value: child.value,
                },
              ],
            });
        }
      },
    },
  };
}
