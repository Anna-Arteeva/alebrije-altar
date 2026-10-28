import * as THREE from "three";

/** Closed, curved, lenticular feather. UVs stay continuous around both faces. */
export function featherGeometry(length: number, width: number, bend = 0.12, seed = 0) {
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  const rows = length < 0.5 ? 10 : 24, sides = length < 0.5 ? 6 : 10;
  for (let j = 0; j <= rows; j++) {
    const t = j / rows;
    const profile = Math.pow(Math.sin(Math.PI * t), 0.72) * (0.72 + 0.28 * t);
    for (let k = 0; k <= sides; k++) {
      const a = k / sides * Math.PI * 2;
      const edge = 1 + 0.025 * Math.sin(t * 90 + seed);
      positions.push(
        Math.cos(a) * (width * profile * edge + 0.002) + bend * t * t,
        length * t,
        Math.sin(a) * (0.028 * profile + 0.002) + 0.10 * Math.sin(t * Math.PI) + bend * 0.4 * t * t,
      );
      uvs.push((Math.cos(a) * profile + 1) * 0.5, t);
      if (j < rows && k < sides) {
        const p = j * (sides + 1) + k;
        indices.push(p, p + sides + 1, p + 1, p + 1, p + sides + 1, p + sides + 2);
      }
    }
  }
  for (const end of [0, 1]) {
    const center = positions.length / 3;
    positions.push(end * bend, end * length, end * bend * 0.4);
    uvs.push(0.5, end);
    const ring = end * rows * (sides + 1);
    for (let k = 0; k < sides; k++) {
      if (end) indices.push(center, ring + k + 1, ring + k);
      else indices.push(center, ring + k, ring + k + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

const neckCenters = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 2.50, 0.05), new THREE.Vector3(0, 3.12, 0.55),
    new THREE.Vector3(0, 3.85, 0.73), new THREE.Vector3(0, 4.45, 0.73),
    new THREE.Vector3(0, 4.92, 0.79),
  ]);
const neckRadii = [0.58, 0.58, 0.41, 0.29, 0.31];
export function neckSample(t: number) {
  const ri = t * 4;
  return { center: neckCenters.getPoint(t), radius: THREE.MathUtils.lerp(neckRadii[Math.floor(ri)], neckRadii[Math.min(4, Math.floor(ri) + 1)], ri % 1) };
}
export function neckGeometry() {
  const p: number[] = [], uv: number[] = [], ix: number[] = [];
  const rows = 44, cols = 48;
  for (let j = 0; j <= rows; j++) {
    const t = j / rows, { center: c, radius: r } = neckSample(t);
    for (let i = 0; i <= cols; i++) {
      const a = i / cols * Math.PI * 2;
      const carved = 1 + 0.012 * Math.sin(a * 17 + t * 20) * Math.sin(Math.PI * t);
      p.push(c.x + Math.sin(a) * r * carved, c.y, c.z + Math.cos(a) * r * 1.1 * carved);
      uv.push(i / cols, t * 0.92);
      if (i < cols && j < rows) {
        const n = j * (cols + 1) + i;
        ix.push(n, n + 1, n + cols + 1, n + 1, n + cols + 2, n + cols + 1);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(ix); geo.computeVertexNormals();
  return geo;
}

export function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
