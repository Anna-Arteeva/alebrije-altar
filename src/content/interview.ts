import type { InterviewPhase } from "../lib/interview-phase.ts";

// The only cultural notes the alebrije may share during the interview, so it
// teaches what is true rather than what sounds nice. Keep "many families"
// phrasing; practices vary by region and family. Relative imports only: the
// server prompt and the guardrail script both read this.

export const CULTURAL_NOTES: Record<InterviewPhase, string[]> = {
  welcome: [
    "In many Mexican homes, families believe that on Día de Muertos the people we love come back to visit.",
    "The ofrenda, a home altar, is how families welcome them home, with their photo, flowers, favorite foods and stories.",
    "It is more a reunion than a goodbye, with laughter and tears side by side.",
  ],
  who: [
    "Many families write the person's name on a calaverita, a little sugar skull, so the visitor knows it is for them.",
    "Many families keep November 1 for the angelitos, children who have died, and November 2 for adults.",
  ],
  photo: [
    "A photo sits at the top of the ofrenda, so everyone knows whose visit the family is waiting for.",
  ],
  objects: [
    "Families place things the person loved on the ofrenda, so they feel at home when they arrive.",
    "Their favorite foods and drinks are set out too, to welcome them after a long journey.",
  ],
  memories: [
    "Telling their stories is part of the celebration. Remembering them out loud is how families keep them close.",
  ],
  elements: [
    "Many altars gather the four elements: water for thirst after the journey, papel picado for the wind, cempasúchil and bread for the earth, and candles for fire.",
    "The bright color and scent of cempasúchil, Mexican marigolds, are said to guide the visitors home.",
  ],
  finish: [
    "Many families set up their ofrenda around October 31 and keep it through November 2.",
  ],
};

// Well-known phrases the alebrije may sprinkle in. One per message at most.
export const SPANISH_PHRASES = [
  "Hola",
  "Buenos días",
  "Buenas tardes",
  "Buenas noches",
  "¡Qué bonito!",
  "Qué lindo",
  "Claro que sí",
  "Poco a poco (little by little)",
  "Con cariño (with love)",
  "Gracias por compartir (thank you for sharing)",
  "¡Bienvenido! / ¡Bienvenida!",
];

export function greetingFor(hour: number) {
  if (hour >= 5 && hour < 12) return "Buenos días";
  if (hour >= 12 && hour < 19) return "Buenas tardes";
  return "Buenas noches";
}
