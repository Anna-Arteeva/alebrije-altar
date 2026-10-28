import OpenAI from "openai";
import type { Uploadable } from "openai/uploads";
import { buildImagePrompt, wantsTransparent, type ImageRequest } from "./image-prompt.ts";

// Relative imports only: this module is shared with scripts/generate-element-art.ts.

export async function generateImage(
  client: OpenAI,
  model: string,
  request: ImageRequest,
  // Style references: when given, the model paints a new image to match them.
  references: Uploadable[] = [],
) {
  const transparent = wantsTransparent(request.kind);
  const params = {
    model,
    size: "1024x1024",
    quality: "medium",
    output_format: "webp",
    output_compression: 85,
  } as const;

  const paint = (background: "transparent" | "opaque", withReferences: boolean) => {
    const prompt = buildImagePrompt(request, background === "transparent", withReferences);
    return withReferences
      ? client.images.edit({ ...params, image: references, prompt, background })
      : client.images.generate({ ...params, prompt, background });
  };

  let result;
  try {
    result = await paint(transparent ? "transparent" : "opaque", references.length > 0);
  } catch (error) {
    // Transparency is in preview on some models, and some can't take
    // references; retry with neither.
    if (!(error instanceof OpenAI.BadRequestError) || (!transparent && references.length === 0)) throw error;
    result = await paint("opaque", false);
  }

  const b64 = result.data?.[0]?.b64_json;
  if (!b64) throw new Error("The image model returned no image.");
  return { b64, mime: "image/webp" };
}
