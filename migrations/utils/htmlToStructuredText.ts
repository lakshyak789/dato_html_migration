import { parse } from "parse5";
import {
  parse5ToStructuredText,
  Options,
} from "datocms-html-to-structured-text";
import { validate } from "datocms-structured-text-utils";

export default async function htmlToStructuredText(
  html: string,
  settings: Options
) {
  if (!html) {
    return null;
  }

  // console.log(
  //   "this is html to structured text",
  //   html["en-IN" as keyof typeof html]
  // );
  // throw new Error("This is not an error. This is just to abort javascript");
  let html_content: any =
    typeof html === "object" ? Object.values(html)[0] : html;
  const result = await parse5ToStructuredText(
    parse(html_content, {
      sourceCodeLocationInfo: true,
    }),
    settings
  );

  const validationResult = validate(result);

  if (!validationResult.valid) {
    throw new Error(validationResult.message);
  }

  return result;
}
