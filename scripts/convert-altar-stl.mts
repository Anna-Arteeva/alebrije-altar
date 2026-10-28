// Converts the sculpted ofrenda STL into a light, indexed, meshopt-compressed GLB the 3D scene can stream.
// Usage: node --experimental-strip-types scripts/convert-altar-stl.mts [input.stl] [output.glb] [triangles]
import { readFileSync } from "node:fs";
import { BufferAttribute, BufferGeometry } from "three";
import { separateAltarFrames } from "./altar-frames.mts";
import { writeAltarGlb } from "./altar-glb.mts";
import { MeshoptSimplifier } from "meshoptimizer";
import { paintAltar } from "./altar-paint.mts";

const [input = "altar/diademuertos_ofrenda_altar_v1.stl", output = "public/altar/ofrenda-altar.glb", target = "150000"] = process.argv.slice(2);
const stl = readFileSync(input);
const count = stl.readUInt32LE(80);
if (84 + count * 50 !== stl.length) throw new Error("Only binary STL files are supported");

// STL is Z-up in millimetres; the scene is Y-up, so (x, y, z) becomes (x, z, -y).
const soup = new Float32Array(count * 9);
for (let t = 0; t < count; t++) {
  const base = 84 + t * 50 + 12;
  for (let v = 0; v < 3; v++) {
    const o = base + v * 12, i = t * 9 + v * 3;
    soup[i] = stl.readFloatLE(o); soup[i + 1] = stl.readFloatLE(o + 8); soup[i + 2] = -stl.readFloatLE(o + 4);
  }
}

await MeshoptSimplifier.ready;
// Weld coincident corners so the simplifier sees one connected surface; a few hundred
// non-manifold edges in the sculpt lock the default mode, so allow Permissive collapses.
const remap = MeshoptSimplifier.generatePositionRemap(soup, 3);
const welded = new Uint32Array(count * 3);
for (let i = 0; i < welded.length; i++) welded[i] = remap[i];
const [simplified, error] = MeshoptSimplifier.simplify(welded, soup, 3, Number(target) * 3, .01, ["Permissive"]);
const original = simplified.slice();
// compactMesh renumbers the indices in place and returns old → new vertex ids.
const [order, vertexCount] = MeshoptSimplifier.compactMesh(simplified);
const indices = simplified;
const positions = new Float32Array(vertexCount * 3);
for (const old of original) positions.set(soup.subarray(old * 3, old * 3 + 3), order[old] * 3);

// Centre on X/Z and rest the base on the floor.
const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < positions.length; i++) { const a = i % 3; min[a] = Math.min(min[a], positions[i]); max[a] = Math.max(max[a], positions[i]); }
const offset = [(min[0] + max[0]) / 2, min[1], (min[2] + max[2]) / 2];
for (let i = 0; i < positions.length; i++) positions[i] -= offset[i % 3];
for (let a = 0; a < 3; a++) { max[a] -= offset[a]; min[a] -= offset[a]; }

const colors = paintAltar(positions, indices);

const geometry = new BufferGeometry();
geometry.setAttribute("position", new BufferAttribute(positions, 3));
geometry.setIndex(new BufferAttribute(indices, 1)); geometry.computeVertexNormals();
const parts = separateAltarFrames(positions, indices, colors, geometry.attributes.normal.array as Float32Array);
await writeAltarGlb(parts, output); geometry.dispose();
console.log(parts.map(part => `${part.name}: ${part.indices.length / 3} triangles`).join(", "));
console.log(`${count} → ${indices.length / 3} triangles, ${vertexCount} vertices, error ${error.toFixed(4)}, size ${(max[0] - min[0]).toFixed(1)}×${(max[1] - min[1]).toFixed(1)}×${(max[2] - min[2]).toFixed(1)}mm → ${output}`);
