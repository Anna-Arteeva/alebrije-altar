// Checks that a memory the model saved is really the user's own words.
//
// The model may split a long message into single memories, trim filler
// ("I remember...", "also,") and fix an obvious typo. It may not rephrase,
// switch from "I" to "they", or add anything. So nearly every word of the
// memory has to appear, in the same order, in what the user wrote.

const MIN_MATCH = 0.9;

export function isFaithful(memory: string, source: string) {
  const words = tokens(memory);
  if (words.length === 0) return false;
  return matchedInOrder(words, tokens(source)) / words.length >= MIN_MATCH;
}

export function tokens(text: string) {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[^\p{L}\p{N}'\s]+/gu, " ")
    .split(/\s+/)
    .map((word) => word.replace(/^'+|'+$/g, ""))
    .filter(Boolean);
}

// Longest common subsequence of words, where a one-letter typo fix still
// counts as the same word.
function matchedInOrder(memory: string[], source: string[]) {
  let previous = new Array<number>(source.length + 1).fill(0);
  for (const word of memory) {
    const row = new Array<number>(source.length + 1).fill(0);
    for (let j = 1; j <= source.length; j++) {
      row[j] = sameWord(word, source[j - 1])
        ? previous[j - 1] + 1
        : Math.max(previous[j], row[j - 1]);
    }
    previous = row;
  }
  return previous[source.length];
}

function sameWord(a: string, b: string) {
  if (a === b) return true;
  if (a.length === 3 && b.length === 3) return isSwap(a, b);
  if (Math.min(a.length, b.length) < 4 || Math.abs(a.length - b.length) > 1) return false;
  return withinOneEdit(a, b);
}

// Short words only forgive swapped letters ("teh"), not different ones.
function isSwap(a: string, b: string) {
  return [...a].sort().join("") === [...b].sort().join("") && withinOneEdit(a, b);
}

function withinOneEdit(a: string, b: string) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) {
    // One substitution, or two neighbouring letters swapped ("teh").
    if (a.slice(i + 1) === b.slice(i + 1)) return true;
    return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2);
  }
  // One letter added or dropped.
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}
