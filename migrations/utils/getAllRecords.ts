import { Client } from "@datocms/cli/lib/cma-client-node";

export default async function getAllRecords(
  client: Client,
  modelApiKey: string
) {
  const records = await client.items.list({
    filter: { ids: `191349897` },
    nested: "true",
  });
  console.log(`Found  records!`, JSON.stringify(records, null, "\t"));

  // throw new Error("halt");
  return records;
}
