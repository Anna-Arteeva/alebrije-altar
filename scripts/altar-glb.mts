import { writeFileSync } from "node:fs";
import { MeshoptEncoder } from "meshoptimizer";
import type { SculptPart } from "./altar-frames.mts";

/** Normals keep 12 of 16 bits so the clearcoat highlights stay smooth; positions stay float. */
const NORMAL_BITS = 12, POSITION_BITS = 15;

/**
 * Export each sculpt part as a named node with its own local pivot, meshopt-compressed
 * (EXT_meshopt_compression + KHR_mesh_quantization) at full triangle count.
 */
export async function writeAltarGlb(parts: SculptPart[], output: string) {
  await MeshoptEncoder.ready;
  const buffers: Buffer[] = [];
  const views: object[] = [];
  const accessors: object[] = [];
  let offset = 0, fallbackOffset = 0;
  function view(data: Uint8Array, count: number, stride: number, mode: string, target: number, filter?: string) {
    const encoded = Buffer.from(MeshoptEncoder.encodeGltfBuffer(data, count, stride, mode));
    const padding = (4 - encoded.length % 4) % 4;
    buffers.push(encoded, Buffer.alloc(padding));
    // Buffer 1 is the decoded layout the loader never fetches; buffer 0 holds the compressed bytes.
    views.push({ buffer: 1, byteOffset: fallbackOffset, byteLength: count * stride, ...(mode === "ATTRIBUTES" ? { byteStride: stride } : {}), target,
      extensions: { EXT_meshopt_compression: { buffer: 0, byteOffset: offset, byteLength: encoded.length, byteStride: stride, count, mode, ...(filter ? { filter } : {}) } } });
    offset += encoded.length + padding; fallbackOffset += count * stride;
    return views.length - 1;
  }
  function accessor(bufferView: number, componentType: number, count: number, type: string, extra: object = {}) {
    accessors.push({ bufferView, componentType, count, type, ...extra });
    return accessors.length - 1;
  }
  const bytes = (data: ArrayBufferView) => new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  const meshes = parts.map(part => {
    // Reorder for the vertex cache; this also makes the streams compress far better.
    const indices = part.indices.slice();
    const [remap, count] = MeshoptEncoder.reorderMesh(indices, true, true);
    const positions = new Float32Array(count * 3), normals = new Float32Array(count * 4), colors = new Uint8Array(count * 4);
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < part.positions.length / 3; i++) {
      const to = remap[i]; if (to === 0xffffffff) continue;
      for (let c = 0; c < 3; c++) {
        const v = part.positions[i * 3 + c]; positions[to * 3 + c] = v; normals[to * 4 + c] = part.normals[i * 3 + c];
        min[c] = Math.min(min[c], v); max[c] = Math.max(max[c], v);
      }
      for (let c = 0; c < 4; c++) colors[to * 4 + c] = Math.round(part.colors[i * 4 + c] / 257);
    }
    const position = accessor(view(MeshoptEncoder.encodeFilterExp(positions, count, 12, POSITION_BITS), count, 12, "ATTRIBUTES", 34962, "EXPONENTIAL"), 5126, count, "VEC3", { min, max });
    const normal = accessor(view(MeshoptEncoder.encodeFilterOct(normals, count, 8, NORMAL_BITS), count, 8, "ATTRIBUTES", 34962, "OCTAHEDRAL"), 5122, count, "VEC3", { normalized: true });
    const color = accessor(view(colors, count, 4, "ATTRIBUTES", 34962), 5121, count, "VEC4", { normalized: true });
    const index = accessor(view(bytes(indices), indices.length, 4, "TRIANGLES", 34963), 5125, indices.length, "SCALAR");
    return { name: part.name, primitives: [{ attributes: { POSITION: position, COLOR_0: color, NORMAL: normal }, indices: index }] };
  });
  const bin = Buffer.concat(buffers);
  const extensions = ["EXT_meshopt_compression", "KHR_mesh_quantization"];
  const gltf = { asset: { version: "2.0", generator: "convert-altar-stl / separate-frames / meshopt" },
    extensionsUsed: extensions, extensionsRequired: extensions,
    scene: 0, scenes: [{ nodes: parts.map((_, i) => i) }], nodes: parts.map((part, i) => ({ name: part.name, mesh: i, translation: part.pivot })),
    meshes, buffers: [{ byteLength: bin.length }, { byteLength: fallbackOffset, extensions: { EXT_meshopt_compression: { fallback: true } } }],
    bufferViews: views, accessors };
  const json = Buffer.from(JSON.stringify(gltf));
  const paddedJson = Buffer.alloc((json.length + 3) & ~3, 0x20); json.copy(paddedJson);
  const header = Buffer.alloc(12); header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + paddedJson.length + bin.length, 8);
  function chunk(type: number, data: Buffer) { const h = Buffer.alloc(8); h.writeUInt32LE(data.length, 0); h.writeUInt32LE(type, 4); return [h, data]; }
  writeFileSync(output, Buffer.concat([header, ...chunk(0x4e4f534a, paddedJson), ...chunk(0x004e4942, bin)]));
}
