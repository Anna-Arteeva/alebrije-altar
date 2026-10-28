// Cut the fused sculpt along each frame's tilted bounds. Interpolate its original
// vertex paint/normals, and cap the cuts on both the frame and the remaining altar.
import { ShapeUtils, Vector2, Vector3 } from "three";
import { SCULPTED_FRAME_SPECS } from "../src/lib/altar3d/sculpted-frames.ts";

type Vertex = { p: number[]; c: number[]; n: number[] };
type Triangle = { vertices: Vertex[]; cap?: boolean };
type Plane = { n: number[]; d: number };
const EPS = 1e-6;
const dot = (a: number[], b: number[]) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const key = (v: Vertex) => v.p.map(x => Math.round(x * 1e5)).join(":");
const mix = (a: Vertex, b: Vertex, t: number): Vertex => ({
  p: a.p.map((v, i) => v + (b.p[i] - v) * t),
  c: a.c.map((v, i) => v + (b.c[i] - v) * t),
  n: a.n.map((v, i) => v + (b.n[i] - v) * t),
});
function triangulate(vertices: Vertex[], cap = false): Triangle[] {
  const result: Triangle[] = [];
  for (let i = 1; i + 1 < vertices.length; i++) {
    const a = new Vector3(...vertices[0].p), b = new Vector3(...vertices[i].p), c = new Vector3(...vertices[i + 1].p);
    if (b.sub(a).cross(c.sub(a)).lengthSq() > 1e-15) result.push({ vertices: [vertices[0], vertices[i], vertices[i + 1]], cap });
  }
  return result;
}
function cutTriangle(triangle: Triangle, plane: Plane) {
  const inside: Vertex[] = [], outside: Vertex[] = [], crossing: Vertex[] = [];
  const vertices = triangle.vertices;
  for (let i = 0; i < 3; i++) {
    const a = vertices[i], b = vertices[(i + 1) % 3];
    const da = dot(a.p, plane.n) + plane.d, db = dot(b.p, plane.n) + plane.d;
    if (da >= -EPS) inside.push(a);
    if (da <= EPS) outside.push(a);
    if ((da > EPS && db < -EPS) || (da < -EPS && db > EPS)) {
      const v = mix(a, b, da / (da - db)); inside.push(v); outside.push(v); crossing.push(v);
    } else if (Math.abs(da) <= EPS) crossing.push(a);
  }
  return { inside: triangulate(inside, triangle.cap), outside: triangulate(outside, triangle.cap), crossing };
}
function caps(segments: Vertex[][], plane: Plane): Triangle[] {
  const points = new Map<string, Vertex>(), neighbours = new Map<string, Set<string>>();
  for (const segment of segments) for (const point of segment) points.set(key(point), point);
  const allPoints = [...points.values()];
  for (const segment of segments) {
    const unique = [...new Map(segment.map(v => [key(v), v])).values()];
    if (unique.length !== 2) continue;
    const [a, b] = unique;
    const direction = b.p.map((x, i) => x - a.p[i]), lengthSq = dot(direction, direction);
    if (lengthSq < 1e-14) continue;
    // Earlier cuts can leave a vertex midway along a cap edge. Split those
    // T-junctions before stitching, including when two frames share a cut height.
    const line: { t: number; point: Vertex }[] = [{ t: 0, point: a }, { t: 1, point: b }];
    for (const point of allPoints) {
      const delta = point.p.map((x, i) => x - a.p[i]);
      const t = dot(delta, direction) / lengthSq;
      if (t <= 1e-8 || t >= 1 - 1e-8) continue;
      if (delta.reduce((sum, x, i) => sum + (x - t * direction[i]) ** 2, 0) < 1e-10) line.push({ t, point });
    }
    line.sort((a, b) => a.t - b.t);
    for (let i = 0; i + 1 < line.length; i++) {
      const a = key(line[i].point), b = key(line[i + 1].point); if (a === b) continue;
      if (!neighbours.has(a)) neighbours.set(a, new Set());
      if (!neighbours.has(b)) neighbours.set(b, new Set());
      // Shared coplanar edges cancel, leaving only the boundary that needs a cap.
      if (neighbours.get(a)!.has(b)) {
        neighbours.get(a)!.delete(b); neighbours.get(b)!.delete(a);
        if (!neighbours.get(a)!.size) neighbours.delete(a);
        if (!neighbours.get(b)!.size) neighbours.delete(b);
      } else { neighbours.get(a)!.add(b); neighbours.get(b)!.add(a); }
    }
  }
  const loops: Vertex[][] = [];
  while (neighbours.size) {
    const first = neighbours.keys().next().value!;
    let current = first;
    const loop: Vertex[] = [];
    do {
      loop.push(points.get(current)!);
      const next = neighbours.get(current)?.values().next().value;
      if (!next) throw new Error(`Open frame cut at ${current}`);
      neighbours.get(current)!.delete(next); neighbours.get(next)?.delete(current);
      if (!neighbours.get(current)!.size) neighbours.delete(current);
      if (!neighbours.get(next)?.size) neighbours.delete(next);
      current = next;
    } while (current !== first && loop.length <= points.size + 1);
    if (current !== first) throw new Error("Frame cut did not close");
    if (loop.length > 2) loops.push(loop);
  }
  const normal = new Vector3(...plane.n).normalize().negate();
  const u = new Vector3(0, Math.abs(normal.y) > .9 ? 0 : 1, Math.abs(normal.y) > .9 ? 1 : 0).cross(normal).normalize();
  const v = normal.clone().cross(u);
  const shapes = loops.map(loop => loop.map(p => new Vector2(dot(p.p, u.toArray()), dot(p.p, v.toArray()))));
  function contains(poly: Vector2[], p: Vector2) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  }
  const areas = shapes.map(s => Math.abs(ShapeUtils.area(s)));
  const parents = shapes.map((s, i) => shapes.reduce((parent, other, j) =>
    j !== i && areas[j] > areas[i] && contains(other, s[0]) && (parent === -1 || areas[j] < areas[parent]) ? j : parent, -1));
  const depth = (i: number): number => parents[i] === -1 ? 0 : 1 + depth(parents[i]);
  const result: Triangle[] = [];
  for (let i = 0; i < loops.length; i++) {
    if (depth(i) % 2) continue;
    const holes = loops.map((_, j) => j).filter(j => parents[j] === i);
    const flat = [...loops[i], ...holes.flatMap(j => loops[j])].map(p => ({ ...p, n: normal.toArray() }));
    for (const indices of ShapeUtils.triangulateShape(shapes[i], holes.map(j => shapes[j]))) {
      const vertices = indices.map(j => flat[j]);
      const a = new Vector3(...vertices[0].p), b = new Vector3(...vertices[1].p), c = new Vector3(...vertices[2].p);
      if (b.sub(a).cross(c.sub(a)).dot(normal) < 0) vertices.reverse();
      result.push({ vertices, cap: true });
    }
  }
  return result;
}
/** The lower moulding is fused into the flower bank in the source sculpt.
 * Mirror the clean upper carving across the opening's centre, in its tilted
 * plane, to repair those occluded contact areas into a freestanding frame. */
function repairFrame(triangles: Triangle[], middle: number, slope: number): Triangle[] {
  const plane = { n: [0, 1, 0], d: -middle };
  const upper: Triangle[] = [];
  for (const triangle of triangles) {
    const distances = triangle.vertices.map(v => v.p[1] - middle);
    if (distances.every(d => d >= -EPS)) upper.push(triangle);
    else if (distances.some(d => d > EPS)) upper.push(...cutTriangle(triangle, plane).inside);
  }
  const lower = upper.map(t => ({ ...t, vertices: [...t.vertices].reverse().map(v => {
    const y = 2 * middle - v.p[1];
    return { p: [v.p[0], y, v.p[2] + slope * (v.p[1] - y)], c: v.c, n: [v.n[0], -v.n[1] + 2 * slope * v.n[2], v.n[2]] };
  }) }));
  return [...upper, ...lower];
}
export type SculptPart = { name: string; pivot: readonly number[]; positions: Float32Array; normals: Float32Array; colors: Uint16Array; indices: Uint32Array };
function pack(name: string, triangles: Triangle[], pivot: readonly number[]): SculptPart {
  const positions: number[] = [], normals: number[] = [], colors: number[] = [], indices: number[] = [];
  const vertices = new Map<string, number>();
  for (const triangle of triangles) for (const v of triangle.vertices) {
    const k = [...v.p, ...v.n, ...v.c].map(x => Math.round(x * 1e6)).join(":");
    let index = vertices.get(k);
    if (index === undefined) {
      index = positions.length / 3; vertices.set(k, index);
      positions.push(...v.p.map((x, i) => x - pivot[i]));
      normals.push(...new Vector3(...v.n).normalize().toArray()); colors.push(...v.c.map(x => Math.round(x)));
    }
    indices.push(index);
  }
  return { name, pivot, positions: new Float32Array(positions), normals: new Float32Array(normals), colors: new Uint16Array(colors), indices: new Uint32Array(indices) };
}
export function separateAltarFrames(positions: Float32Array, indices: Uint32Array, colors: Uint16Array, normals: Float32Array): SculptPart[] {
  const vertices: Vertex[] = Array.from({ length: positions.length / 3 }, (_, i) => ({
    p: [...positions.subarray(i * 3, i * 3 + 3)], n: [...normals.subarray(i * 3, i * 3 + 3)], c: [...colors.subarray(i * 4, i * 4 + 4)],
  }));
  let body: Triangle[] = [];
  for (let i = 0; i < indices.length; i += 3) body.push({ vertices: [vertices[indices[i]], vertices[indices[i + 1]], vertices[indices[i + 2]]] });
  const original = body;
  const bodyCaps: Triangle[] = [];
  const frames: SculptPart[] = [];
  for (const spec of SCULPTED_FRAME_SPECS) {
    const { x, y, depth } = spec.bounds;
    const planes: Plane[] = [
      { n: [0, 1, 0], d: -y[0] }, { n: [0, -1, 0], d: y[1] },
      { n: [1, 0, 0], d: -x[0] }, { n: [-1, 0, 0], d: x[1] },
      { n: [0, spec.slope, 1], d: -depth[0] }, { n: [0, -spec.slope, -1], d: depth[1] },
    ];
    let candidate = original;
    for (const plane of planes) {
      const kept: Triangle[] = [], segments: Vertex[][] = [];
      for (const triangle of candidate) {
        const distances = triangle.vertices.map(v => dot(v.p, plane.n) + plane.d);
        if (distances.every(d => d >= -EPS)) {
          kept.push(triangle);
          const onPlane = triangle.vertices.filter((_, i) => Math.abs(distances[i]) <= EPS);
          if (onPlane.length === 2) segments.push(onPlane);
          else if (onPlane.length === 3) for (let i = 0; i < 3; i++) segments.push([onPlane[i], onPlane[(i + 1) % 3]]);
          continue;
        }
        if (distances.every(d => d <= EPS)) continue;
        const cut = cutTriangle(triangle, plane);
        kept.push(...cut.inside);
        if (cut.crossing.length >= 2) segments.push(cut.crossing);
      }
      kept.push(...caps(segments, plane)); candidate = kept;
    }
    if (!candidate.length) throw new Error(`No geometry found for ${spec.id}`);
    // Subtract the same volume from the body without capping intermediate
    // partitions. Only the final frame caps belong on the body's exposed cuts.
    let toCut = body;
    const outside: Triangle[] = [];
    for (const plane of planes) {
      const inside: Triangle[] = [];
      for (const triangle of toCut) {
        const distances = triangle.vertices.map(v => dot(v.p, plane.n) + plane.d);
        if (distances.every(d => d >= -EPS)) inside.push(triangle);
        else if (distances.every(d => d <= EPS)) outside.push(triangle);
        else { const cut = cutTriangle(triangle, plane); inside.push(...cut.inside); outside.push(...cut.outside); }
      }
      toCut = inside;
    }
    body = outside;
    bodyCaps.push(...candidate.filter(t => t.cap).map(t => ({ vertices: [...t.vertices].reverse().map(v => ({ ...v, n: v.n.map(x => -x) })) })));
    frames.push(pack(spec.id, repairFrame(candidate, (spec.opening.topLeft[1] + spec.opening.bottomLeft[1]) / 2, spec.slope), spec.pivot));
  }
  return [pack("altar-body", [...body, ...bodyCaps], [0, 0, 0]), ...frames];
}
