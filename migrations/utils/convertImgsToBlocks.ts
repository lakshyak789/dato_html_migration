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

var fs = require('fs');
var util = require('util');
var log_file = fs.createWriteStream("/Users/sateeshmanne" + '/debug.log', {flags : 'w'});
var log_stdout = process.stdout;

console.log = function(d) { //
  log_file.write(util.format(d) + '\n');
  log_stdout.write(util.format(d) + '\n');
};

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
              node.tagName !== "img" &&
              node.tagName !== "a" &&
              node.tagName !== "p" &&
              node.tagName !== "em" &&
              node.tagName !== "table" &&
              node.tagName !== "code" &&
              node.tagName !== "a") ||
            liftedImages.has(node) ||
            parents.length === 1
          ) {
            console.log("unhandled node = " + JSON.stringify(node));
            return;
          }
          if (node.tagName === "table") {
            console.log("*** Log *** - unhandled html table");
          }

          if (node.tagName === "a") {

            if (
              node.children &&
              node.children.length > 0 &&
              node.properties &&
              node.children[0].type === "element" &&
              node.children[0].tagName === "img" &&
              node.children[0].properties
            ) {
              liftedImages.add(node.children[0]);
            } else {
              return;
            }
          }
          if (node.tagName === "em" && node.type === "element") {
            console.log(" all em nodes = " + JSON.stringify(node));
            if (
              !node.children ||
              node.children.length === 0 ||
              node.children[0].type !== "element" 
            ) {
              return;
            }
            let node_string = JSON.stringify(node)
            if (node.tagName == "em" && JSON.stringify(node).includes("Editor’s Note")) {
              console.log("Alert!!! *** Index = " + index + "has editors note");
              node.children.unshift(
                {
                  "type": "element",
                  "tagName": "hr",
                  "properties": {},
                  "children": [
                  ]
                }
              )
              console.log("editor node value = " + JSON.stringify(node));
            }
          }
          

          if (node.tagName === "p" && node.type === "element")
           {
            console.log("---handling paragraph element---");
            if (
              !node.children ||
              node.children.length === 0 ||
              node.children[0].type !== "text" 
            ) {
              return;
            }
            let child = node.children[0];
            if (!child.value) {
              console.log("---no child value found---");
              return;
            }

            if (
              child.value.includes("[SadhguruSignature") ||
              child.value.includes("[ SadhguruSignature") ||
              child.value.includes("[/button]") ||
              child.value.includes("[youtube]") ||
              child.value.includes("[/image]")
            ) {
              node.tagName = "code";
              console.log("---tagName set to Code---");
              return index;
            } else if (child.value.includes("[pullquote]")) {
              child.value = child.value.replace("[pullquote]", "");
              child.value = child.value.replace("[/pullquote]", "");
              return;
            } else if (child.value.includes("[readmore]")) {
              child.value = child.value.replace("[readmore]", "");
              child.value = child.value.replace("[/readmore]", "");
              return;
            } else if (child.value.includes("[caption]")) {
              child.value = child.value.replace("[caption]", "");
              child.value = child.value.replace("[/caption]", "");
              return;
            } else if (child.value.includes("[question]")) {
              child.value = child.value.replace("[question]", "");
              child.value = child.value.replace("[/question]", "");
              return;
            } else if (child.value.includes("[divider]")) {
              node.tagName = "hr"
              return;
            } else if (child.value.includes("[poem")) {
              console.log("*** Log *** - poem retained as is")
              return;
            } else {
              return;
            }
          } else if (node.tagName === "a" && !node.children) {
            return;
          } else if (
            node.tagName === "a" &&
            node.children &&
            node.children.length > 0 &&
            node.properties &&
            node.children[0].type === "element" &&
            node.children[0].tagName === "img" &&
            node.children[0].properties
          ) {
            node.tagName = "anchorbanner";
            node.children[0].tagName = "banner";
            liftedImages.add(node);
          }
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
    },
    // now that images are top-level, convert them into `block` dast nodes
    handlers: {
      anchorbanner: async (
        createNode: CreateNodeFunction,
        node: HastNode,
        _context: Context
      ) => {
        if (
          node.type !== "element" ||
          !node.properties ||
          !node.children ||
          node.children.length === 0
        ) {
          return;
        }
        // return if anchor tag doesn't have any image.
        if (
          node.children &&
          node.properties &&
          (node.children[0].type !== "element" ||
            node.children[0].tagName !== "banner")
        ) {
          return;
        }
        const { href: url01 } = node.properties;
        let upload: any;

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
          upload = await findOrCreateUploadWithUrl(client, url);
        }

        return createNode("block", {
          item: buildBlockRecord({
            item_type: { id: modelIds.ad_image_banner.id, type: "item_type" },
            image: {
              upload_id: upload.id,
              alt: upload.alt ?? "",
              title: upload.title ?? "",
            },
            link_url: url01,
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
        const { src: url, alt: img_alt, title: img_title } = node.properties;

        if (url == "" || url == null || url == undefined) {
          console.log("img url is not found, aborting block creation", + url);
        }

        console.log("before calling findorCreate url", + url);
        const upload = await findOrCreateUploadWithUrl(client, url);
        console.log("---before img block creation---");

        const resp =  createNode("block", {
          item: buildBlockRecord({
            item_type: { id: modelIds.single_image.id, type: "item_type" },
            image: {
              upload_id: upload.id,
              alt: img_alt ?? "",
              title: img_title ?? "",
            },
          }),
        });
        console.log("---after img block creation---");
        return resp;
      },
      video: async (
        createNode: CreateNodeFunction,
        node: HastNode,
        _context: Context
      ) => {
        if (node.type !== "element" || !node.properties) {
          return;
        }

        const { src: url } = node.properties;
        const upload = await findOrCreateUploadWithUrl(client, url);

        console.log("---before video block creation---");

        const resp =  createNode("block", {
          item: buildBlockRecord({
            item_type: { id: modelIds.single_image.id, type: "item_type" },
            image: {
              upload_id: upload.id,
            },
          }),
        });

        console.log("---after img block creation---");
        return resp
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
        console.log("---before iframe block creation---");
        const resp = createNode("block", {
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
        console.log("---after iframe block creation---");
        console.log("*** Log *** - media_embed_v2 created successfully");
        return resp;
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
          } else if (child.value.includes("[/youtube]")) {
            condition = "youtube";
          } else if (child.value.includes("[/image]")) {
            condition = "image";
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
            // let regex = /src="([^"]+)"/;
            let regex = /src\s*=\s*['"]?([^'"\s>]+)/;

            let matches = child.value.match(regex);
            if (!matches) return;
            let url = matches[1];

            let button_text = child.value.substring(
              child.value.indexOf("]") + 1,
              child.value.indexOf("[/button]")
            );

            console.log("---before simple button block creation---");

            const resp1 = createNode("block", {
              item: buildBlockRecord({
                item_type: { id: modelIds.simple_button.id, type: "item_type" },
                button_text: button_text,
                link_url: url,
              }),
            });

            console.log("---after simple button block creation---");
            return resp1;

          case "youtube":
            const regex_youtube = /\[youtube\](.*?)\[\/youtube\]/;
            const match: any = child.value.match(regex_youtube);

            if (!match) {
              return;
            }
            const yt_url = match[1];
            const details: any = urlParser.parse(yt_url);
            const video_thumbnail = `https://img.youtube.com/vi/${details.id}/0.jpg`;

            console.log("---before youtube block creation---");

            const resp = createNode("block", {
              item: buildBlockRecord({
                item_type: {
                  id: modelIds.media_embed_v2.id,
                  type: "item_type",
                },
                video: {
                  url: yt_url,
                  width: 200,
                  height: 113,
                  provider: details.provider,
                  provider_uid: details.id,
                  thumbnail_url: video_thumbnail,
                  title: "test title",
                },
              }),
            })
            console.log("---after youtube button block creation---");
            console.log("*** Log *** - Youtube media_embed_v2 created successfully");
            return resp;

          case "image":
            const src_regex = /src\s*=\s*['"]?([^'"\s>]+)/;
            const alt_regex = /alt\s*=\s*['"]?([^'"\s>]+)/;
            const title_regex = /title\s*=\s*['"]?([^'"\s>]+)/;
            const src_match: any = child.value.match(src_regex);
            const alt_match: any = child.value.match(alt_regex);
            const title_match: any = child.value.match(title_regex);

            if (!src_match) return;
            const src_value = src_match[1];
            const alt_value: any = ((alt_match != null) && (alt_match != undefined)) ? alt_match[1] : "";
            const title_value: any = ((title_match != null) && (title_match != undefined)) ? title_match[1] : "";

            const upload = await findOrCreateUploadWithUrl(client, src_value);

            console.log("---before case-image block creation---");

            const resp2 =  createNode("block", {
              item: buildBlockRecord({
                // item_type: { id: modelIds.image_block.id, type: "item_type" },
                item_type: { id: modelIds.single_image.id, type: "item_type" },
                image: {
                  upload_id: upload.id,
                  alt: alt_value ?? "",
                  title: title_value ?? "",
                },
              }),
            });

            console.log("---after case-image block creation---");
            return resp2

          case "sadhguru_signature_love_grace":
            console.log("---before sadhguru_signature_love_grace block creation---");
            const resp3 =  createNode("block", {
              item: buildBlockRecord({
                item_type: {
                  id: modelIds.sadhguru_signature_love_grace.id,
                  type: "item_type",
                },

                text: "147374130",
              }),
            });
            console.log("---after sadhguru_signature_love_grace block creation---");
            return resp3

          default:
            console.log("---before default block creation---");
            const resp4 = createNode("paragraph", {
              type: "paragraph",
              children: [
                {
                  type: "span",
                  value: child.value,
                },
              ],
            });
            console.log("---after default block creation---");
        }
      },
    },
  };
}
