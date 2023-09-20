import getModelIdsByApiKey from "./utils/getModelIdsByApiKey";
import createStructuredTextFieldFrom from "./utils/createStructuredTextFieldFrom";
import htmlToStructuredText from "./utils/htmlToStructuredText";
import getAllRecords from "./utils/getAllRecords";
import swapFields from "./utils/swapFields";
import convertImgsToBlocks from "./utils/convertImgsToBlocks";
import convertIframeToBlocks from "./utils/convertIframetoBlock";
import convertShortCodeToBlocks from "./utils/convertShortCodetoBlock";
import { Client, SimpleSchemaTypes } from "@datocms/cli/lib/cma-client-node";

type HtmlArticleType = SimpleSchemaTypes.Item & {
  title: string;
  body: string;
};

export default async function convertHtmlArticles(client: Client) {
  const modelIds = await getModelIdsByApiKey(client);

  try {
    await createStructuredTextFieldFrom(client, "yoga_post", "body", [
      modelIds.single_image.id,
      modelIds.media_embed_v2.id,
      modelIds.simple_button.id,
    ]);
  } catch (err: any) {
    if (err.response?.status === 422) {
      console.log(
        "field already exists but it is fine for us lets continue with the code",
        err
      );
    } else console.log(err);
  }
  const records = (await getAllRecords(
    client,
    "yoga_post"
  )) as HtmlArticleType[];

  for (const record of records) {
    const structuredTextContent = await htmlToStructuredText(
      record.body,
      convertImgsToBlocks(client, modelIds)
      // convertShortCodeToBlocks(client, modelIds)
    );

    // throw new Error("record");
    await client.items.update(record.id, {
      structured_text_body: structuredTextContent,
    });
    if (record.meta.status !== "draft") {
      await client.items.publish(record.id);
    }
  }
  //right now we do not need this code because we are not deleting the old field
  // try {
  //   await swapFields(client, "test_article", "body");
  // } catch (err) {
  //   console.log(
  //     "most probably fields already exist but it is fine for us no need to halt the code ",
  //     err
  //   );
  // }
}
