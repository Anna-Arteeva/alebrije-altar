// Paints the eight traditional ofrenda elements once, in the house style,
// and records them in src/content/element-art.json. Re-run to repaint.
//
//   node --experimental-strip-types --env-file=.env.local scripts/generate-element-art.ts [element ...]

import { mkdir, readFile, writeFile } from "node:fs/promises";
import OpenAI from "openai";
import { ELEMENTS } from "../src/content/ofrenda.ts";
import { generateImage } from "../src/lib/ai/generate-image.ts";

const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.5-flare";
const manifestPath = "src/content/element-art.json";
const client = new OpenAI();

const only = process.argv.slice(2);
const keys = Object.values(ELEMENTS)
  .map((e) => e.key)
  .filter((key) => only.length === 0 || only.includes(key));

await mkdir("public/elements", { recursive: true });
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

await Promise.all(
  keys.map(async (key) => {
    const { b64 } = await generateImage(client, model, { kind: "element", subject: ELEMENTS[key].artSubject });
    await writeFile(`public/elements/${key}.webp`, Buffer.from(b64, "base64"));
    manifest[key] = `/elements/${key}.webp`;
    console.log(`painted ${key}`);
  }),
);

await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`Updated ${manifestPath}`);
