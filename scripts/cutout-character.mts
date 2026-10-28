// Cuts Alebrije's full-body painting out of its cream paper so it can stand
// directly in the evening room. The paper is flood-filled from the border, so
// cream fur inside the painted outline is kept; the ground shadow under the
// feet survives as a soft, partly transparent smudge.
import sharp from "sharp";

const source = "public/character/chracter.png";
const target = "public/character/character-cutout.webp";
const preview = process.argv[2];
const STEP = Number(process.argv[3] ?? 3);
const MIN_REGION = Number(process.argv[4] ?? 4000);

const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
// A lightly blurred copy hides the paper grain, so the fill can follow it.
const smooth = await sharp(source).ensureAlpha().blur(1.5).raw().toBuffer();
const { width, height } = info;
const px = (x: number, y: number) => (y * width + x) * 4;
const luma = (i: number) => 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

// Paper colour: median of the border.
const border: number[][] = [];
for (let x = 0; x < width; x++) border.push([...data.subarray(px(x, 0), px(x, 0) + 3)], [...data.subarray(px(x, height - 1), px(x, height - 1) + 3)]);
for (let y = 0; y < height; y++) border.push([...data.subarray(px(0, y), px(0, y) + 3)], [...data.subarray(px(width - 1, y), px(width - 1, y) + 3)]);
const paper = [0, 1, 2].map((c) => border.map((p) => p[c]).sort((a, b) => a - b)[border.length >> 1]);
const paperLuma = 0.299 * paper[0] + 0.587 * paper[1] + 0.114 * paper[2];

// Background spreads only across smooth, paper-coloured pixels: the paper is
// flat, while the cream fur is drawn in fine strokes the fill cannot cross.
// Near the ground the fill is looser, so the painted shadow joins the paper.
const ground = Math.round(height * 0.86);
const distance = (a: Buffer, i: number, b: ArrayLike<number>, j: number) =>
  Math.max(Math.abs(a[i] - b[j]), Math.abs(a[i + 1] - b[j + 1]), Math.abs(a[i + 2] - b[j + 2]));
const pale = (i: number) => Math.max(smooth[i], smooth[i + 1], smooth[i + 2]) - Math.min(smooth[i], smooth[i + 1], smooth[i + 2]) < 95 && smooth[i] > 170;
const isPaper = (n: number) => n >= ground * width ? pale(n * 4) : distance(smooth, n * 4, paper, 0) < 26;
const step = (n: number) => (n >= ground * width ? 255 : STEP);

// Every smooth paper region that touches the border, or is too large to be a
// highlight in the fur (the paper between the legs), is background.
const background = new Uint8Array(width * height);
const seen = new Uint8Array(width * height);
for (let start = 0; start < width * height; start++) {
  if (seen[start] || !isPaper(start)) continue;
  const region = [start];
  let touchesBorder = false;
  seen[start] = 1;
  for (let k = 0; k < region.length; k++) {
    const n = region[k];
    const x = n % width, y = (n / width) | 0;
    if (x === 0 || y === 0 || x === width - 1 || y === height - 1) touchesBorder = true;
    for (const m of [x > 0 ? n - 1 : -1, x < width - 1 ? n + 1 : -1, y > 0 ? n - width : -1, y < height - 1 ? n + width : -1]) {
      if (m < 0 || seen[m] || !isPaper(m) || distance(smooth, m * 4, smooth, n * 4) > step(n)) continue;
      seen[m] = 1;
      region.push(m);
    }
  }
  if (touchesBorder || region.length > MIN_REGION) for (const n of region) background[n] = 1;
}
// Patches of paper caught between shadow strokes under the feet.
for (let n = ground * width; n < width * height; n++) if (pale(n * 4)) background[n] = 1;

// Erode the figure by two pixels so no paper fringe is left, then feather.
let mask = Buffer.from(background.map((b) => (b ? 0 : 255)));
for (let pass = 0; pass < 2; pass++) {
  const next = Buffer.from(mask);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const n = y * width + x;
    if (mask[n] && ((x > 0 && !mask[n - 1]) || (x < width - 1 && !mask[n + 1]) || (y > 0 && !mask[n - width]) || (y < height - 1 && !mask[n + width]))) next[n] = 0;
  }
  mask = next;
}
const feathered = await sharp(mask, { raw: { width, height, channels: 1 } }).blur(1.2).extractChannel(0).raw().toBuffer();

const out = Buffer.alloc(width * height * 4);
for (let n = 0; n < width * height; n++) {
  const i = n * 4;
  const alpha = feathered[n];
  if (background[n]) {
    // Shadow: how much darker than the paper this pixel is, painted in umber.
    const shade = Math.max(0, paperLuma - luma(i) - 10) * 5;
    if (shade > alpha) {
      out.set([58, 30, 18, Math.min(150, shade)], i);
      continue;
    }
  }
  out.set([data[i], data[i + 1], data[i + 2], alpha], i);
}

await sharp(out, { raw: { width, height, channels: 4 } }).trim({ threshold: 1 }).webp({ quality: 90, alphaQuality: 100 }).toFile(target);
const { width: w, height: h } = await sharp(target).metadata();
console.log(`${target} ${w}×${h} (paper rgb ${paper.join(",")})`);

if (preview) {
  await sharp({ create: { width: w!, height: h!, channels: 4, background: "#2a1410" } })
    .composite([{ input: target }]).png().toFile(preview);
  console.log(`preview ${preview}`);
}
