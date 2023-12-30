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
              node.tagName !== "img" &&
              node.tagName !== "a" &&
              node.tagName !== "p" &&
              node.tagName !== "code" &&
              node.tagName !== "span" &&
              node.tagName !== "a") ||
            liftedImages.has(node) ||
            parents.length === 1
          ) {
            return;
          }

          if (node.tagName === "a") {
            console.log("node", JSON.stringify(node));

            if (
              node.children &&
              node.children.length > 0 &&
              node.properties &&
              node.children[0].type === "element" &&
              node.children[0].tagName === "img" &&
              node.children[0].properties
            ) {
              // const { src } = node.children[0].properties;
              // Object.assign(node.properties, { rel: src });
              liftedImages.add(node.children[0]);
            } else {
              return;
            }

            // throw new Error("tets");
          }
          //shortcode reading from paragraph
          if (
            node.tagName === "p" ||
            (node.tagName === "span" && node.type === "element")
          ) {
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
              child.value.includes("[SadhguruSignature") ||
              child.value.includes("[ SadhguruSignature") ||
              child.value.includes("[/button]") ||
              child.value.includes("[youtube]") ||
              child.value.includes("[/image]") ||
              child.value.includes("[/pullquote]") ||
              child.value.includes("[quote]") ||
              child.value.includes("[twitter]") ||
              child.value.includes("[/SadhguruImage]")
            ) {
              node.tagName = "code";
              return index;
            } else if (child.value.includes("[seprator]")) {
              // child.value = child.value.replace("[seprator]", "");

              const shortCodeIndex = child.value.indexOf("[seprator]");

              // const splittedArray = child.value.split("[seprator]");
              console.log("splitted array", shortCodeIndex);
              // const filteredSplittedArray = splittedArray.filter((n) => n);
              if (shortCodeIndex === 0) {
                node.children.push({
                  type: "element",
                  tagName: "hr",
                  properties: {},
                  children: [],
                });
                // throw new Error("this is a first part error");
              } else if (shortCodeIndex > 0) {
                node.children.unshift({
                  type: "element",
                  tagName: "hr",
                  properties: {},
                  children: [],
                });
                // throw new Error("this is a first part error");
              }
              // else if (filteredSplittedArray.length >= 2)

              console.log(
                "this is body =",
                JSON.stringify(body, null, "\t"),
                "node =",
                JSON.stringify(node, null, "\t"),
                "children =",
                JSON.stringify(child, null, "\t"),
                "parent =",
                JSON.stringify(parents, null, "\t"),
                "parent len =",
                JSON.stringify(parents.length, null, "\t"),
                "index=",
                JSON.stringify(index, null, "\t")
              );

              // throw new Error("this is a man made error");
              child.value = child.value.replace("[seprator]", "");
              JSON.stringify(node).replace("[seprator]", "");
              return;
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
            } else {
              return;
            }
          } else if (node.tagName === "a" && !node.children) {
            console.log("ignored a node = " + JSON.stringify(node));
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
            console.log("lifted a node = " + JSON.stringify(node));
            node.tagName = "anchorbanner";
            node.children[0].tagName = "banner";
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

        if (
          node.type !== "element" ||
          !node.properties ||
          !node.children ||
          node.children.length === 0
        ) {
          console.log("handler ignored a node 1 = " + JSON.stringify(node));
          return;
        }
        // return if anchor tag doesn't have any image.
        if (
          node.children &&
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

        console.log("img node = " + JSON.stringify(node));

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
          } else if (
            child.value.includes("[/pullquote]") ||
            child.value.includes("[quote]")
          ) {
            condition = "pullquote";
          } else if (child.value.includes("[twitter]")) {
            condition = "twitter";
          } else if (child.value.includes("[/SadhguruImage]")) {
            condition = "SadhguruImage";
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
          case "pullquote":
            let extractedText: any = child.value.match(
              /\[pullquote\](.*?)\[\/pullquote\]/
            );
            if (extractedText !== null) {
              extractedText = extractedText[1];
            } else {
              return;
            }
            // insertLog(
            //   dato_id,
            //   "converting pullquoteshortcode to quote block",
            //   "info"
            // );
            return createNode("block", {
              item: buildBlockRecord({
                item_type: {
                  id: modelIds.quote.id,
                  type: "item_type",
                },

                quote: extractedText,
              }),
            });
          case "twitter":
            let matchUrl: RegExpMatchArray | null = child.value.match(
              /\[twitter\](.*?)\[\/twitter\]/
            );
            let twitterValue: string;
            if (matchUrl) {
              twitterValue = matchUrl[1];
              console.log("this is twitter value", twitterValue);
            } else {
              console.log("No match found");
              return;
            }
            // throw new Error("Could not find");
            return createNode("block", {
              item: buildBlockRecord({
                item_type: {
                  id: modelIds.twitter_block.id,
                  type: "item_type",
                },
                tweet_url: new URL(twitterValue),
              }),
            });

          case "SadhguruImage":
            let matchurl: RegExpMatchArray | null = child.value.match(
              /\[SadhguruImage\](.*?)\[\/SadhguruImage\]/
            );
            let sadhguruimageValue: string;
            if (matchurl) {
              sadhguruimageValue = matchurl[1];
              console.log(sadhguruimageValue);
            } else {
              console.log("No match found");
              return;
            }
            // throw new Error("Could not find");
            return createNode("block", {
              item: buildBlockRecord({
                item_type: {
                  id: modelIds.structured_text.id,
                  type: "item_type",
                },
                body: {
                  schema: "dast",
                  document: {
                    children: [
                      {
                        children: [
                          {
                            type: "span",
                            value: "test it out",
                          },
                        ],
                        type: "paragraph",
                      },
                    ],
                    type: "root",
                  },
                },
                style: "sg-wisdom-image-at-start",
              }),
            });
          case "simple_button":
            console.log("node in simple_button", node);
            let regex = /src="([^"]+)"/;

            let matches = child.value.match(regex);
            if (!matches) return;
            let url = matches[1];

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
          case "youtube":
            const regex_youtube = /\[youtube\](.*?)\[\/youtube\]/;
            const match: any = child.value.match(regex_youtube);

            if (!match) {
              return;
            }
            const yt_url = match[1];
            const details: any = urlParser.parse(yt_url);
            const video_thumbnail = `https://img.youtube.com/vi/${details.id}/0.jpg`;
            return createNode("block", {
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
            });

          case "image":
            const src_regex = /src=(\S+)/;
            const src_match: any = child.value.match(src_regex);
            if (!src_match) return;
            const src_value = src_match[1];

            const upload = await findOrCreateUploadWithUrl(client, src_value);

            return createNode("block", {
              item: buildBlockRecord({
                item_type: { id: modelIds.single_image.id, type: "item_type" },
                image: {
                  upload_id: upload.id,
                },
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
