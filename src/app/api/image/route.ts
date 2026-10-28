import { toFile } from "openai";
import { STYLE_REFERENCES } from "@/content/starter-objects";
import { generateImage } from "@/lib/ai/generate-image";
import { blockedReason, ImageRequest } from "@/lib/ai/image-prompt";
import { errorResponse, IMAGE_MODEL, openai } from "@/lib/ai/openai";

// Paints the alebrije, altar objects and memory vignettes. The browser only
// sends a kind and a subject; the guarded prompt is built on the server.
// Objects are painted from a few starter-set objects as style references, so
// they sit beside the ready-made ones.

export const maxDuration = 120;

export async function POST(request: Request) {
  const parsed = ImageRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid image request." }, { status: 400 });
  }
  const blocked = blockedReason(parsed.data.subject);
  if (blocked) return Response.json({ error: blocked }, { status: 400 });

  try {
    const references = parsed.data.kind === "object" ? await styleReferences(new URL(request.url).origin) : [];
    return Response.json(await generateImage(openai(), IMAGE_MODEL, parsed.data, references));
  } catch (error) {
    return errorResponse(error);
  }
}

// The references are our own static files; fetched once per server instance.
let cached: Promise<ArrayBuffer[]> | null = null;

async function styleReferences(origin: string) {
  cached ??= Promise.all(
    STYLE_REFERENCES.map(async (path) => {
      const response = await fetch(new URL(path, origin));
      if (!response.ok) throw new Error(`Missing style reference ${path}`);
      return response.arrayBuffer();
    }),
  ).catch((error) => {
    cached = null;
    console.error(error);
    return [];
  });
  const buffers = await cached;
  return Promise.all(
    buffers.map((buffer, i) => toFile(buffer, STYLE_REFERENCES[i].split("/").pop(), { type: "image/webp" })),
  );
}
