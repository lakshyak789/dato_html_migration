import { Client } from "@datocms/cli/lib/cma-client-node";

export default async function swapFields(
  client: Client,
  modelApiKey: string,
  fieldApiKey: string
) {
  const oldField = await client.fields.find(`${modelApiKey}::${fieldApiKey}`);
  const newField = await client.fields.find(
    `${modelApiKey}::structured_text_${fieldApiKey}`
  );
  // destroy the old field
  // await client.fields.destroy(oldField.id);
  // rename the new field\
  console.log(
    "old field position is ",
    oldField,
    "fieldApiKey is ",
    fieldApiKey
  );
  await client.fields.update(newField.id, {
    api_key: "structured_" + fieldApiKey,
    label: "structured_" + oldField.label,
  });
}
