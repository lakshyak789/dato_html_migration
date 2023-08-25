import getModelIdsByApiKey from "./utils/getModelIdsByApiKey";
import createStructuredTextFieldFrom from "./utils/createStructuredTextFieldFrom";
import htmlToStructuredText from "./utils/htmlToStructuredText";
import getAllRecords from "./utils/getAllRecords";
import swapFields from "./utils/swapFields";
import convertImgsToBlocks from "./utils/convertImgsToBlocks";
import { Client, SimpleSchemaTypes } from "@datocms/cli/lib/cma-client-node";

type HtmlArticleType = SimpleSchemaTypes.Item & {
  title: string;
  body: string;
};

export default async function convertHtmlArticles(client: Client) {
  const modelIds = await getModelIdsByApiKey(client);

  await createStructuredTextFieldFrom(client, "test_article", "body", [
    modelIds.single_image.id,
  ]);

  const records = (await getAllRecords(
    client,
    "test_article"
  )) as HtmlArticleType[];

  for (const record of records) {
    const structuredTextContent = await htmlToStructuredText(
      record.body,
      convertImgsToBlocks(client, modelIds)
    );

    console.log("content image block", structuredTextContent);

    await client.items.update(record.id, {
      structured_text_body: structuredTextContent,
    });
    if (record.meta.status !== "draft") {
      await client.items.publish(record.id);
    }
  }

  await swapFields(client, "test_article", "body");
}
