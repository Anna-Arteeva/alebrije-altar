// Ready-painted personal objects the alebrije offers during the interview,
// from illustration-style/object-starter-set. Picking one places it with its
// existing painting; nothing is generated. Activities are shown through
// objects, never people: shoes for dancing, a pot for cooking. Labels name
// what the person loved, not the thing itself: "A green thumb", not "House plant".

export interface StarterObject {
  key: string;
  label: string;
  hint: string;
  src: string;
  // Used if the user asks for a new version of the painting.
  imageSubject: string;
}

export const STARTER_OBJECTS: StarterObject[] = [
  { key: "enamel-mug", label: "Morning coffee", hint: "coffee, tea, café de olla", src: "/objects/enamel-mug.webp", imageSubject: "a worn floral enamel mug" },
  { key: "guitar", label: "Songs on the guitar", hint: "music they played", src: "/objects/guitar.webp", imageSubject: "a hand-painted wooden guitar" },
  { key: "record-player", label: "Favorite records", hint: "music they loved", src: "/objects/record-player.webp", imageSubject: "a record player with a vinyl record" },
  { key: "dancing-shoes", label: "Dancing all night", hint: "dancing", src: "/objects/dancing-shoes.webp", imageSubject: "a pair of worn dancing shoes" },
  { key: "cooking-pot", label: "Cooking for everyone", hint: "cooking", src: "/objects/cooking-pot.webp", imageSubject: "a clay cooking pot with a wooden spoon" },
  { key: "baking", label: "Sunday baking", hint: "baking", src: "/objects/baking.webp", imageSubject: "a rolling pin, dough and a folded cloth" },
  { key: "lemons", label: "Lemons with everything", hint: "a favorite fruit", src: "/objects/lemons.webp", imageSubject: "whole and cut lemons" },
  { key: "house-plant", label: "A green thumb", hint: "plants and gardens", src: "/objects/house-plant.webp", imageSubject: "a leafy plant in a painted terracotta pot" },
  { key: "painting-palette", label: "Afternoons painting", hint: "painting and making", src: "/objects/painting-palette.webp", imageSubject: "a painter's palette with brushes" },
  { key: "hat", label: "Favorite sun hat", hint: "an everyday hat", src: "/objects/hat.webp", imageSubject: "an everyday woven sun hat" },
  { key: "scarf", label: "Favorite scarf", hint: "something they wore", src: "/objects/scarf.webp", imageSubject: "a woven striped scarf" },
];

export const STARTER_KEYS = STARTER_OBJECTS.map((o) => o.key) as [string, ...string[]];

export function starterObject(key: string) {
  return STARTER_OBJECTS.find((o) => o.key === key);
}

// Style references for painting new objects to match the set.
export const STYLE_REFERENCES = ["/objects/enamel-mug.webp", "/objects/guitar.webp", "/objects/house-plant.webp"];
