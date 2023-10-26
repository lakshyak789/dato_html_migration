import { Client } from '@datocms/cli/lib/cma-client-node';
import path from 'path';

export default async function findOrCreateUploadWithUrl(
  client: Client,
  url: string,
) {
  let upload;

  if (url.startsWith('https://www.datocms-assets.com')) {
    const pattern = path.basename(url).replace(/^[0-9]+\-/, '');

    const matchingUploads = await client.uploads.list({
      filter: {
        fields: {
          filename: {
            matches: {
              pattern,
              case_sensitive: false,
              regexp: false,
            },
          },
        },
      },
    });

    upload = matchingUploads.find((u) => {
      console.log("finding image url = " + url);
      return u.url === url;
    });
  }

  console.log("upload 01 is = ", JSON.stringify(upload));
  console.log("trying to create url = " + url);

  if ( upload == null || upload == undefined ) {
    console.log("upload is null or undefined");
  }

  if (!upload) {
    console.log("created for url" + url)
    upload = await client.uploads.createFromUrl({ url });
  }

  console.log("upload 02 is = " + JSON.stringify(upload));

  return upload;
}
