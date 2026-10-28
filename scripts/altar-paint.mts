// Bakes vertex colours onto the single-shell ofrenda sculpt. Coordinates are millimetres in the
// converted frame: X centred, Y up from the floor, +Z towards the viewer.

type Range = readonly [number, number];
type Region = { x: Range; y: Range; z?: Range; mirror?: boolean; front?: boolean };
type Rule = Region & { paint: Paint };
type Paint = { colors: string[]; edge?: Range; ball?: boolean; wood?: boolean };

// Dark local pigments leave the violet and amber highlights to the scene lights.
const wood: Paint = { colors: ["#512d29"], wood: true };
const marigold: Paint = { colors: ["#432b4d", "#58335f", "#35233f", "#65416c", "#4e2d50"], edge: [0, 1.35] };
const leaf: Paint = { colors: ["#25202e", "#342a3d"], edge: [1.35, 2.4] };
const bone: Paint = { colors: ["#776477"] };
const terracotta: Paint = { colors: ["#402735"] };
const talavera: Paint = { colors: ["#3a2d4c"] };
const wax: Paint = { colors: ["#897181"] };
const frameWood: Paint = { colors: ["#46272c"], wood: true };
const gold: Paint = { colors: ["#6c4c4a"] };
const turquoise: Paint = { colors: ["#2f243c"] };
const dress: Paint = { colors: ["#241d2b"] };
const bread: Paint = { colors: ["#51333b"] };
const fruit: Paint = { colors: ["#4d304e", "#352b40", "#603744"] };
const magenta: Paint = { colors: ["#502e53", "#643c68"], edge: [0, 1.35] };
const solid = (color: string): Paint => ({ colors: [color] });

// Later rules win. Flower and leaf rules only claim surfaces of their mesh density inside a zone.
const RULES: Rule[] = [
  // Every unclaimed surface, including tier tops and sides, is carved dark wood.
  // Marigold banks: arch, pillar flanks, tier clusters and the big pots.
  { x: [-66, 66], y: [180, 238], paint: leaf },
  { x: [-66, 66], y: [180, 238], paint: marigold },
  { x: [-102, -46], y: [108, 205], mirror: true, paint: leaf },
  { x: [-102, -46], y: [108, 205], mirror: true, paint: marigold },
  { x: [-28, 28], y: [104, 134], paint: marigold },
  { x: [-118, -60], y: [74, 104], mirror: true, paint: leaf },
  { x: [-118, -60], y: [74, 104], mirror: true, paint: marigold },
  { x: [-125, -25], y: [44, 68], mirror: true, paint: marigold },
  { x: [-108, -88], y: [52, 72], mirror: true, paint: magenta },
  { x: [-66, -40], y: [196, 236], paint: magenta },
  { x: [40, 66], y: [196, 236], paint: magenta },
  // Arch skull and the hanging papel picado.
  { x: [-22, 22], y: [198, 238], z: [-40, -10], paint: { ...bone, ball: true } },
  { x: [-48, -16], y: [160, 194], z: [-34, -22], paint: solid("#58375f") },
  { x: [-16, 16], y: [160, 194], z: [-34, -22], paint: solid("#483044") },
  { x: [16, 48], y: [160, 194], z: [-34, -22], paint: solid("#382a48") },
  // Niches with catrinas.
  { x: [-82, -64], y: [132, 184], mirror: true, paint: turquoise },
  { x: [-80, -66], y: [132, 176], z: [-26, 0], mirror: true, paint: dress },
  { x: [-77, -69], y: [158, 170], z: [-26, 0], mirror: true, paint: bone },
  // Portrait frames and candles.
  { x: [-20, 19], y: [110, 162], z: [-20, 6], paint: frameWood },
  { x: [-14, 13], y: [116, 154], z: [-12, 6], paint: gold },
  { x: [-48, -27], y: [110, 148], z: [-30, 2], mirror: true, paint: frameWood },
  { x: [-31, -19], y: [108, 142], z: [-20, 2], paint: wax },
  { x: [19, 27], y: [108, 142], z: [-20, 2], paint: wax },
  { x: [-33, -22], y: [72, 100], z: [6, 30], paint: wax },
  { x: [22, 33], y: [72, 100], z: [6, 30], paint: wax },
  // Pottery.
  { x: [-77, -57], y: [104, 131], z: [-25, 3], paint: terracotta },
  { x: [57, 76], y: [104, 131], z: [-25, 3], paint: talavera },
  { x: [-108, -70], y: [50, 79], mirror: true, paint: terracotta },
  { x: [40, 68], y: [74, 100], z: [8, 30], paint: talavera },
  // Food on the middle tier.
  { x: [-55, -26], y: [74, 84], z: [4, 32], paint: talavera },
  { x: [-52, -28], y: [84, 98], z: [4, 32], paint: fruit },
  { x: [-20, 21], y: [74, 82], z: [2, 36], paint: solid("#57455e") },
  { x: [-15, 15], y: [80, 98], z: [8, 36], paint: bread },
  // Sugar skulls.
  { x: [-57, -39], y: [96, 116], z: [-20, 6], mirror: true, paint: bone },
  { x: [28, 46], y: [72, 90], z: [6, 30], paint: bone },
  { x: [-48, -30], y: [50, 70], z: [28, 52], mirror: true, paint: bone },
];

function hash(n: number) { n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; }
const toLinear = (c: number) => (c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

function inside(rule: Rule, x: number, y: number, z: number, facing: number) {
  if (rule.z && (z < rule.z[0] || z > rule.z[1])) return false;
  if (rule.front && facing < .5) return false;
  if (rule.paint.ball) {
    const cx = (rule.x[0] + rule.x[1]) / 2, cy = (rule.y[0] + rule.y[1]) / 2;
    return ((x - cx) / (rule.x[1] - cx)) ** 2 + ((y - cy) / (rule.y[1] - cy)) ** 2 <= 1;
  }
  return x >= rule.x[0] && x <= rule.x[1] && y >= rule.y[0] && y <= rule.y[1];
}

/** Returns normalised 16-bit RGBA in linear space, ready for a glTF COLOR_0 accessor. */
export function paintAltar(positions: Float32Array, indices: Uint32Array) {
  const n = positions.length / 3;
  const normals = new Float32Array(n * 3);
  const neighbours: number[][] = Array.from({ length: n }, () => []);
  for (let t = 0; t < indices.length; t += 3) {
    const [a, b, c] = [indices[t], indices[t + 1], indices[t + 2]];
    const e1 = [0, 1, 2].map((k) => positions[b * 3 + k] - positions[a * 3 + k]);
    const e2 = [0, 1, 2].map((k) => positions[c * 3 + k] - positions[a * 3 + k]);
    const face = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    for (const v of [a, b, c]) for (let k = 0; k < 3; k++) normals[v * 3 + k] += face[k];
    neighbours[a].push(b, c); neighbours[b].push(a, c); neighbours[c].push(a, b);
  }
  for (let v = 0; v < n; v++) {
    const l = Math.hypot(normals[v * 3], normals[v * 3 + 1], normals[v * 3 + 2]) || 1;
    for (let k = 0; k < 3; k++) normals[v * 3 + k] /= l;
  }
  const smooth = (field: Float32Array, passes: number, stride = 1) => {
    for (let p = 0; p < passes; p++) {
      const next = new Float32Array(field.length);
      for (let v = 0; v < n; v++) for (let k = 0; k < stride; k++) {
        let s = field[v * stride + k]; for (const u of neighbours[v]) s += field[u * stride + k];
        next[v * stride + k] = s / (neighbours[v].length + 1);
      }
      field = next;
    }
    return field;
  };
  // Concavity darkens carved recesses.
  let cavity: Float32Array = new Float32Array(n);
  // The simplifier keeps petal clusters as dense tiny triangles while smooth wood, pottery
  // and carving collapse into larger ones, so short local edges mark the marigolds.
  let edge: Float32Array = new Float32Array(n);
  for (let v = 0; v < n; v++) {
    let concave = 0, edges = 0;
    for (const u of neighbours[v]) {
      const d = [0, 1, 2].map((k) => positions[u * 3 + k] - positions[v * 3 + k]), l = Math.hypot(...d) || 1;
      concave += (d[0] * normals[v * 3] + d[1] * normals[v * 3 + 1] + d[2] * normals[v * 3 + 2]) / l;
      edges += l;
    }
    cavity[v] = concave / (neighbours[v].length || 1);
    edge[v] = edges / (neighbours[v].length || 1);
  }
  cavity = smooth(cavity, 2);
  edge = smooth(edge, 3);

  const colors = new Uint16Array(n * 4);
  for (let v = 0; v < n; v++) {
    const x = positions[v * 3], y = positions[v * 3 + 1], z = positions[v * 3 + 2];
    let paint = wood;
    for (const rule of RULES) {
      const facing = normals[v * 3 + 2];
      const hit = inside(rule, x, y, z, facing) || (rule.mirror && inside(rule, -x, y, z, facing));
      if (!hit) continue;
      if (rule.paint.edge && (edge[v] < rule.paint.edge[0] || edge[v] > rule.paint.edge[1])) continue;
      paint = rule.paint;
    }
    // Neighbouring petals pick from the palette in small patches, not per vertex.
    const cell = Math.floor(x / 3.5) * 73856093 ^ Math.floor(y / 3.5) * 19349663 ^ Math.floor(z / 3.5) * 83492791;
    const base = rgb(paint.colors[Math.floor(hash(cell) * paint.colors.length)]);
    // Long, gently warped grain follows the shelves instead of random vertex speckling.
    const grain = paint.wood
      ? .88 + .09 * Math.sin(y * 1.7 + z * .22 + Math.sin(x * .045) * 2.8)
        + .045 * Math.sin(y * 5.3 + z * .65 + Math.sin(x * .07))
      : 1;
    const shade = grain * Math.min(1.06, Math.max(.28, 1 - Math.max(0, cavity[v]) * 2.8 + Math.max(0, -cavity[v]) * .25));
    for (let k = 0; k < 3; k++) colors[v * 4 + k] = Math.round(Math.min(1, toLinear(base[k]) * shade) * 65535);
    colors[v * 4 + 3] = 65535;
  }
  return colors;
}
