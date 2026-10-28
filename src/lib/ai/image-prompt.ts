import { z } from "zod";

// Every image prompt is assembled here on the server, so the house style and
// the guards can't be skipped by whatever text arrives from the client or the
// chat model.

export const ImageRequest = z.object({
  kind: z.enum(["alebrije", "object", "vignette", "element"]),
  subject: z.string().trim().min(2).max(1500),
});
export type ImageRequest = z.infer<typeof ImageRequest>;

// Matches the references in illustration-style/: painterly 2D character art,
// chunky carved-wood shapes, warm rim light. Described in words only, with no
// artist names.
const STYLE =
  "Stylized painterly digital illustration, like a storybook concept painting: soft visible brushwork, chunky playful shapes, " +
  "surfaces that look like carved and hand-painted wood with visible grain and bold folk-art patterns (dots, stripes, petals). " +
  "Rich saturated palette of cempasúchil orange, rosa mexicano pink, turquoise, deep indigo and gold, " +
  "with warm rim light, soft glow and a few floating sparkles. Painted 2D, not a 3D render. Warm, friendly and celebratory, never scary.";

// Objects follow the starter set in illustration-style/object-starter-set,
// the "Painted Folk Sculpture" direction, so new ones sit beside it.
const OBJECT_STYLE =
  "Isolated object illustration for an interactive remembrance altar, in the Painted Folk Sculpture style: tactile matte gouache, " +
  "visible brush overlaps, dry-brush grain, imperfect warm-brown outlines, slight handmade asymmetry, shallow painted volume and a warm earthy Mexican folk palette. " +
  "Use selective cempasúchil orange, saffron, cochineal red, dusty magenta, oxidised turquoise, cactus green, indigo, ochre and cacao. " +
  "Keep the complete object centred and recognisable at small size. No glossy 3D rendering, no photorealism, no stereotypes or sacred motifs.";

const MATCH_REFERENCES =
  "The attached images are other objects from the same set. Match their painting style, outlines, texture, palette and lighting closely, " +
  "but paint only the new object described here; do not copy their subjects.";

const GUARDS =
  "Show no people at all: no human figures, faces, hands or bodies. " +
  "No Halloween or horror imagery: no pumpkins, bats, blood, zombies or ghosts, nothing scary. " +
  "No text, letters, numbers or logos. Not in the style of any film, studio or existing character.";

const BLOCKED = /\b(pixar|disney|coco|pepita|dante|miguel rivera|h[eé]ctor rivera)\b/i;

export function blockedReason(subject: string) {
  if (BLOCKED.test(subject)) return "Let's describe it in your own words instead of a film reference.";
  return null;
}

export function buildImagePrompt(
  { kind, subject }: ImageRequest,
  transparent = wantsTransparent(kind),
  withReferences = false,
) {
  // Saying "transparent" to a model that can't do it gets a painted checkerboard.
  const backdrop = transparent
    ? "Isolated on a plain transparent background."
    : "Isolated on a plain, flat warm cream background.";
  switch (kind) {
    case "alebrije":
      return [
        `A single friendly alebrije creature, full body, centered, facing the viewer with a kind expression: ${subject}.`,
        "It is a fantastical hybrid of several animals with small horns, fins, tufts or tails, every surface covered in intricate painted patterns.",
        "It is not a winged jaguar and not a hairless dog.",
        STYLE,
        GUARDS,
        backdrop,
      ].join(" ");
    case "object":
      return [
        `A single object, centered, painted like a cut-out to place on a Día de Muertos altar: ${subject}.`,
        withReferences ? MATCH_REFERENCES : "",
        OBJECT_STYLE,
        GUARDS,
        backdrop,
        "No table or scenery.",
      ].filter(Boolean).join(" ");
    case "element":
      return [
        `A single object, centered, painted like a cut-out to place on a Día de Muertos altar: ${subject}.`,
        STYLE,
        GUARDS,
        backdrop,
        "No table or scenery.",
      ].join(" ");
    case "vignette":
      return [
        `A small warm vignette illustration: ${subject}.`,
        "Composed as a simple scene with a few objects and a sense of place, framed softly.",
        STYLE,
        GUARDS,
        "Warm textured paper background with soft light.",
      ].join(" ");
  }
}

export function wantsTransparent(kind: ImageRequest["kind"]) {
  return kind !== "vignette";
}
