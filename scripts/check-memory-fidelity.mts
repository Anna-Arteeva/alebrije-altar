// Fixed cases for the memory fidelity check: the alebrije may split and trim
// the user's words, never rewrite them.
//
//   npm run check:fidelity

import { isFaithful } from "../src/lib/ai/memory-fidelity.ts";

const source = `ok let me think. I remember she always sang in the kitchen while making tamales on Sundays.
Also she hated when we were late, she'd say "el tiempo no espera". And her garden, oh her roses were teh best on the street`;

const cases: [string, string, boolean][] = [
  ["verbatim sentence", "she always sang in the kitchen while making tamales on Sundays.", true],
  ["filler trimmed", "She hated when we were late, she'd say \"el tiempo no espera\".", true],
  ["typo fixed", "her roses were the best on the street", true],
  ["capitalised and punctuated", "Her garden, oh her roses were the best on the street.", true],
  ["switched to third person", "She was always late and hated it.", false],
  ["paraphrased", "She loved singing while cooking tamales every weekend.", false],
  ["embellished", "she always sang beautifully in the warm kitchen while making tamales on Sundays", false],
  ["invented", "She taught everyone in the family to dance.", false],
  ["empty", "   ", false],
];

let failed = 0;
for (const [name, memory, expected] of cases) {
  const ok = isFaithful(memory, source) === expected;
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${ok ? "" : ` (expected ${expected ? "kept" : "rejected"})`}`);
}
console.log(`\n${cases.length - failed}/${cases.length} passed.`);
process.exitCode = failed ? 1 : 0;
