import type { ElementKey } from "@/lib/types";

// Cultural content shown in the app. Keep phrasing to "many families" rather
// than claims about what everyone does; practices vary by region and family.

export interface ElementInfo {
  key: ElementKey;
  name: string;
  gloss: string; // short English explanation of the Spanish term
  meaning: string;
  natural: "water" | "wind" | "earth" | "fire" | null;
  // Subject for the one-time element illustration script.
  artSubject: string;
}

export const ELEMENTS: Record<ElementKey, ElementInfo> = {
  cempasuchil: {
    key: "cempasuchil",
    name: "Cempasúchil",
    gloss: "Mexican marigolds",
    meaning:
      "Their bright color and scent help guide spirits home. Many families scatter the petals into a path leading to the altar.",
    natural: "earth",
    artSubject: "a generous bunch of orange cempasúchil marigold flowers with a few loose petals",
  },
  candles: {
    key: "candles",
    name: "Velas",
    gloss: "candles",
    meaning: "Their flames light the way for the visitors.",
    natural: "fire",
    artSubject: "three white and cream pillar candles with small warm flames, wax drips",
  },
  water: {
    key: "water",
    name: "Agua",
    gloss: "a glass of water",
    meaning: "Quenches the thirst of visitors after their long journey.",
    natural: "water",
    artSubject: "a simple clear glass of water on a small embroidered cloth",
  },
  salt: {
    key: "salt",
    name: "Sal",
    gloss: "salt",
    meaning: "A small dish of salt stands for purification.",
    natural: null,
    artSubject: "a small painted clay dish holding a mound of white salt",
  },
  copal: {
    key: "copal",
    name: "Copal",
    gloss: "resin incense",
    meaning: "Its smoke cleanses the space and carries prayers.",
    natural: null,
    artSubject: "a clay copal burner (sahumador) with soft curling smoke",
  },
  papel_picado: {
    key: "papel_picado",
    name: "Papel picado",
    gloss: "cut tissue-paper banners",
    meaning: "Represents the wind. When it moves, many say the visitors are near.",
    natural: "wind",
    artSubject: "a single sheet of pink and orange papel picado with cut flower patterns",
  },
  pan_de_muerto: {
    key: "pan_de_muerto",
    name: "Pan de muerto",
    gloss: "bread of the dead",
    meaning:
      "Sweet bread offered as hospitality, alongside the person's favorite foods. It stands for the earth.",
    natural: "earth",
    artSubject: "a round pan de muerto sweet bread dusted with sugar, with dough bone shapes on top",
  },
  calaveritas: {
    key: "calaveritas",
    name: "Calaveritas",
    gloss: "sugar skulls",
    meaning:
      "A sweet, playful reminder that life is short. Many carry the name of the person on the forehead.",
    natural: null,
    artSubject: "two small decorated sugar skull candies with colorful icing flowers, no names",
  },
};

export const PHOTO_MEANING = "The photo shows whose spirit is being welcomed home.";
export const OBJECTS_MEANING =
  "Personal objects are things they loved, so they feel at home when they visit.";

export const DIA_DE_MUERTOS = {
  summary:
    "Día de Muertos is a living Mexican tradition with Indigenous and Catholic roots, recognized by UNESCO as Intangible Cultural Heritage in 2008. Many families believe the dead return for a visit, and welcome them with an ofrenda (altar), food, music, flowers and stories. It is a reunion and a celebration, where grief, humor and warmth sit side by side.",
  calendar: [
    { date: "Oct 31", text: "Many families prepare the altar." },
    { date: "Nov 1", text: "Día de los Angelitos, for children who have died." },
    { date: "Nov 2", text: "For adults who have died." },
  ],
  levels:
    "An altar gathers the four elements: water, wind, earth and fire. Altars can have one, two, three or seven levels. There is no single correct version, and practices vary by region and family.",
};

export const ABOUT_ALEBRIJES = {
  title: "About alebrijes",
  body: [
    "Alebrijes were created by Pedro Linares López, a papier-mâché artisan in Mexico City, after a fever dream in 1936 filled with fantastical creatures shouting “¡Alebrijes!”.",
    "Artisans in Oaxaca, among them Manuel Jiménez, later carved them in copal wood and painted them with bright patterns. Today, families of artisans keep the craft alive.",
    "In this app, your alebrije is a guide for the living: it helps you gather memories. It never speaks for the person you are remembering.",
  ],
};

export interface SupportLine {
  region: string;
  name: string;
  phone?: string;
  url?: string;
}

const SUPPORT: Record<string, SupportLine> = {
  DE: { region: "Germany", name: "TelefonSeelsorge (free, 24/7)", phone: "0800 111 0 111" },
  AT: { region: "Austria", name: "TelefonSeelsorge", phone: "142" },
  CH: { region: "Switzerland", name: "Die Dargebotene Hand", phone: "143" },
  US: { region: "United States", name: "988 Suicide & Crisis Lifeline", phone: "988" },
  MX: { region: "Mexico", name: "Línea de la Vida", phone: "800 911 2000" },
  GB: { region: "United Kingdom", name: "Samaritans", phone: "116 123" },
};

const FALLBACK: SupportLine = {
  region: "Anywhere",
  name: "Find a free, confidential helpline near you",
  url: "https://findahelpline.com",
};

// Picks lines for the browser's region, always ending with the global finder.
export function supportLinesFor(locales: readonly string[]) {
  const regions = locales
    .map((locale) => locale.split("-")[1]?.toUpperCase())
    .filter((region): region is string => !!region && region in SUPPORT);
  const lines = [...new Set(regions.length ? regions : ["DE"])].map((r) => SUPPORT[r]);
  return [...lines, FALLBACK];
}
