import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BoxGeometry, Group, Vector3 } from "three";
import { placeSculptedFrames } from "../src/lib/altar3d/sculpted-portraits.ts";
import { separateAltarFrames, type SculptPart } from "./altar-frames.mts";
import { SCULPTED_FRAME_SPECS } from "../src/lib/altar3d/sculpted-frames.ts";
import { portraitSlot } from "../src/lib/altar3d/layout.ts";

function volume(part: SculptPart) {
  let result = 0;
  const p = part.positions, indices = part.indices;
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
    result += p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1])
      + p[a + 1] * (p[b + 2] * p[c] - p[b] * p[c + 2]) + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c]);
  }
  return result / 6;
}
const cube = new BoxGeometry(140, 100, 100); cube.translate(0, 130, 0);
const colors = new Uint16Array(cube.attributes.position.count * 4).fill(32768);
const parts = separateAltarFrames(cube.attributes.position.array as Float32Array, new Uint32Array(cube.index!.array), colors, cube.attributes.normal.array as Float32Array);
assert.deepEqual(parts.map(part => part.name), ["altar-body", ...SCULPTED_FRAME_SPECS.map(spec => spec.id)]);
const cutVolume = SCULPTED_FRAME_SPECS.reduce((sum, spec) => sum + (spec.bounds.x[1] - spec.bounds.x[0]) * (spec.bounds.y[1] - spec.bounds.y[0]) * (spec.bounds.depth[1] - spec.bounds.depth[0]), 0);
assert.ok(Math.abs(volume(parts[0]) - (140 * 100 * 100 - cutVolume)) < 1, "Caps seal the subtracted body, including matching cut heights");
for (let i = 0; i < SCULPTED_FRAME_SPECS.length; i++) {
  const spec = SCULPTED_FRAME_SPECS[i], part = parts[i + 1];
  const middle = (spec.opening.topLeft[1] + spec.opening.bottomLeft[1]) / 2;
  const expected = (spec.bounds.x[1] - spec.bounds.x[0]) * 2 * (spec.bounds.y[1] - middle) * (spec.bounds.depth[1] - spec.bounds.depth[0]);
  assert.ok(Math.abs(volume(part) - expected) < .1, `${part.name} is closed after repairing the lower moulding`);
  assert.ok(part.colors.every(v => v === 32768), "Cutting and repair preserve vertex paint");
  for (let j = 0; j < part.normals.length; j += 3) assert.ok(Math.abs(Math.hypot(...part.normals.subarray(j, j + 3)) - 1) < 1e-5);
}
cube.dispose();

for (const count of [0, 1, 2, 3, 4]) {
  for (let i = 0; i < Math.max(1, count); i++) {
    const slot = portraitSlot(i, count);
    assert.ok(slot.width > 0);
    if (i < 3) assert.ok(slot.sculptedFrame && !slot.portraitFrame);
    else assert.ok(slot.portraitFrame && !slot.sculptedFrame);
  }
}
const single = portraitSlot(0, 1), shared = portraitSlot(0, 2), invitation = portraitSlot(0, 0);
assert.equal(single.width, shared.width * 2);
assert.equal(single.sculptedFrame!.scale, 2);
assert.equal(invitation.sculptedFrame!.scale, 1);
assert.equal(single.point[1], shared.point[1], "The enlarged frame stays at the same top-shelf height");
assert.ok(single.point[2] > shared.point[2], "The enlarged frame stays in front of the decorations");

const frameGroups = new Map(SCULPTED_FRAME_SPECS.map(spec => [spec.id, new Group()]));
const identities = [...frameGroups.values()];
for (const count of [0, 1, 2, 3, 4, 3, 2, 1, 0]) {
  const slots = Array.from({ length: Math.max(1, count) }, (_, i) => portraitSlot(i, count));
  placeSculptedFrames(frameGroups, slots);
  assert.equal([...frameGroups.values()].filter(group => group.visible).length, Math.max(1, Math.min(3, count)));
  const main = frameGroups.get("portrait-centre")!;
  const opening = slots[0].sculptedFrame!.opening;
  const topLeft = new Vector3(...opening.topLeft).applyMatrix4(main.matrixWorld);
  const topRight = new Vector3(...opening.topRight).applyMatrix4(main.matrixWorld);
  assert.ok(Math.abs(topLeft.distanceTo(topRight) - slots[0].width) < 1e-10, "The photo and frame share one world transform");
  assert.deepEqual(main.position.toArray(), [...slots[0].point]);
  assert.equal(main.position.y, shared.point[1], "The frame's shelf anchor stays fixed through count transitions");
  assert.deepEqual([...frameGroups.values()], identities, "Count transitions reuse the same three frames");
}

const glb = readFileSync(new URL("../public/altar/ofrenda-altar.glb", import.meta.url));
const gltf = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString());
assert.deepEqual(gltf.nodes.map((node: { name: string }) => node.name), parts.map(part => part.name));
for (const mesh of gltf.meshes) {
  const primitive = mesh.primitives[0];
  const positions = gltf.accessors[primitive.attributes.POSITION], normals = gltf.accessors[primitive.attributes.NORMAL];
  assert.ok(positions.count > 0 && positions.count === normals.count);
  assert.ok(positions.min.every((v: number, i: number) => Number.isFinite(v) && positions.max[i] > v));
}
console.log("PASS: capped frame extraction, repaired frame volumes, vertex colours/normals, count-based layouts, and named GLB parts");
