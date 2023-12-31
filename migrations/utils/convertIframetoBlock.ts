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
            (node.tagName !== "iframe" && node.tagName !== "img") ||
            liftedImages.has(node) ||
            parents.length === 1
          ) {
            return;
          }

          console.log(
            "this is body =",
            JSON.stringify(body, null, "\t"),
            "node =",
            JSON.stringify(node, null, "\t"),
            "index =",
            JSON.stringify(index, null, "\t"),
            "children =",
            JSON.stringify(parents, null, "\t")
          );
          // throw new Error("this is a man made error");

          const imgParent = parents[parents.length - 1];
          console.log(
            "1st part this is imgPArent",
            imgParent,
            "node=",
            node,
            "parents.length=",
            parents.length,
            "index=",
            index
          );
          imgParent.children.splice(index, 1);
          console.log(
            "2  this is imgPArent spliced",
            imgParent.children.splice(index, 1),
            "node=",
            node
          );
          let i = parents.length;
          let splitChildrenIndex = index;
          let childrenAfterSplitPoint: HastNode[] = [];
          console.log("--i", --i);
          while (--i > 0) {
            const parent = parents[i];
            const parentsParent = parents[i - 1];

            childrenAfterSplitPoint =
              parent.children.splice(splitChildrenIndex);
            splitChildrenIndex = parentsParent.children.indexOf(parent);

            console.log(
              "childrenAfterSplitPoint",
              childrenAfterSplitPoint,
              "splitChildrenIndex=",
              splitChildrenIndex
            );

            let nodeInserted = false;

            if (i === 1) {
              splitChildrenIndex += 1;
              parentsParent.children.splice(splitChildrenIndex, 0, node);
              liftedImages.add(node);

              console.log(
                "parentsParent.children.splice(splitChildrenIndex, 0, node)",
                parentsParent.children.splice(splitChildrenIndex, 0, node),
                "node=",
                node
              );

              nodeInserted = true;
            }

            splitChildrenIndex += 1;

            if (childrenAfterSplitPoint.length > 0) {
              parentsParent.children.splice(splitChildrenIndex, 0, {
                ...parent,
                children: childrenAfterSplitPoint,
              });
              console.log("childrenAfterSplitPoint.length > 0", "node=", node);
            }

            if (parent.children.length === 0) {
              splitChildrenIndex -= 1;
              parentsParent.children.splice(
                nodeInserted ? splitChildrenIndex - 1 : splitChildrenIndex,
                1
              );
              console.log("parent.children.length === 0)", "node=", node);
            }
          }
        }
      );
    },

    // now that images are top-level, convert them into `block` dast nodes
    handlers: {
      img: async (
        createNode: CreateNodeFunction,
        node: HastNode,
        _context: Context
      ) => {
        if (node.type !== "element" || !node.properties) {
          return;
        }

        const { src: url } = node.properties;
        const upload = await findOrCreateUploadWithUrl(client, url);

        return createNode("block", {
          item: buildBlockRecord({
            item_type: { id: modelIds.single_image.id, type: "item_type" },
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
      // code: async (
      //   createNode: CreateNodeFunction,
      //   node: HastNode,
      //   _context: Context
      // ) => {
      //   let condition = "";
      //   if (
      //     node.type === "element" &&
      //     node.children &&
      //     node.children.length > 0 &&
      //     node.children[0].type === "text"
      //   ) {
      //     let child = node.children[0];
      //     if (!child.value) {
      //       return;
      //     }

      //     if (
      //       child.value.includes("[pullquote]") &&
      //       child.value.includes("[/pullquote]")
      //     ) {
      //       condition = "pullquote";
      //     } else if (
      //       child.value.includes("[add_image_block]") &&
      //       child.value.includes("[/add_image_block]")
      //     ) {
      //       condition = "add_image_block";
      //     } else if (child.value.includes("[/button]")) {
      //       condition = "simple_button";
      //     } else {
      //       condition = "";
      //       return;
      //     }
      //   }

      //   if (node.type !== "element" || !node.children) {
      //     return;
      //   }
      //   switch (condition) {
      //     case "simple_button":
      //       console.log("node in simple_button", node);
      //       let regex = /(?:https?|ftp):\/\/[\n\S]+/g;
      //       if (!node.children[0]) {
      //         return;
      //       }
      //       if (node.children[0].type !== "text") {
      //         return;
      //       }
      //       let child = node.children[0];
      //       if (!child || !child.value) {
      //         return;
      //       }
      //       let matches = child.value.match(regex);
      //       if (!matches) return;
      //       let url = matches[0].replace(/(^\.+|\]+$)/gm, "");
      //       url = url.replace('^"|"$', "");
      //       let button_text = child.value.substring(
      //         child.value.indexOf("]") + 1,
      //         child.value.indexOf("[/button]")
      //       );

      //       return createNode("block", {
      //         item: buildBlockRecord({
      //           item_type: { id: modelIds.simple_button.id, type: "item_type" },
      //           button_text: button_text,
      //           link_url: url,
      //         }),
      //       });
      //     case "add_image_banner":
      //       return createNode("block", {
      //         item: buildBlockRecord({
      //           item_type: {
      //             id: modelIds.add_image_banner.id,
      //             type: "item_type",
      //           },
      //           url: {},
      //         }),
      //       });

      //     case "newsletter_block":
      //       return createNode("block", {
      //         item: buildBlockRecord({
      //           item_type: {
      //             id: modelIds.newsletter_block.id,
      //             type: "item_type",
      //           },
      //           url: {},
      //         }),
      //       });

      //     case "sadhguru_signature_love_grace":
      //       return createNode("block", {
      //         item: buildBlockRecord({
      //           item_type: {
      //             id: modelIds.sadhguru_signature_love_grace.id,
      //             type: "item_type",
      //           },
      //           url: {},
      //         }),
      //       });

      //     default:
      //       return;
      //   }
      // },
    },
  };
}
