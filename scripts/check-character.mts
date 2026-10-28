import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import * as THREE from "three";
import { buildCharacter } from "../src/lib/character/model.ts";
import { animateCharacter } from "../src/lib/character/animation.ts";
import { featherGeometry } from "../src/lib/character/geometry.ts";

const textures = [new THREE.Texture(), new THREE.Texture(), new THREE.Texture()];
const rig = buildCharacter(...textures as [THREE.Texture, THREE.Texture, THREE.Texture]);
let meshes = 0, triangles = 0;
rig.root.traverse((object) => {
  if (!(object instanceof THREE.Mesh)) return;
  meshes++;
  const geometry = object.geometry as THREE.BufferGeometry;
  triangles += (geometry.index?.count ?? geometry.getAttribute("position").count) / 3;
  for (const attribute of ["position", "normal", "uv"]) {
    const data = geometry.getAttribute(attribute);
    assert(data, `${object.name || "Mesh"} must have ${attribute}`);
    assert(Array.from(data.array).every(Number.isFinite), `${attribute} must remain finite`);
  }
  geometry.computeBoundingSphere();
  assert(Number.isFinite(geometry.boundingSphere!.radius), "Culling bounds must be finite");
});
assert(meshes < 80, "Static parts must remain batched for mobile rendering");
assert(triangles < 450_000, "Character triangle budget exceeded");

// Both sides must have outward-facing normals, including the narrow feather edge.
const feather = featherGeometry(1, 0.2, 0);
const position = feather.getAttribute("position"), normal = feather.getAttribute("normal");
const middleRight = 12 * 11;
assert(position.getX(middleRight) > 0 && normal.getX(middleRight) > 0, "Feather shell must face outward");
feather.dispose();

const bounds = new THREE.Box3().setFromObject(rig.root);
assert(bounds.min.y > -0.10 && bounds.min.y < 0.1, "Feet should touch the ground");
assert(bounds.max.y > 6 && bounds.max.y < 7, "Full silhouette must fit the camera envelope");
assert(bounds.min.x < -2 && bounds.max.x > 2, "Both wings must have genuine geometry");

const fixedParts = rig.root.children.filter((object) => object instanceof THREE.Mesh);
const fixedBounds = fixedParts.map((object) => new THREE.Box3().setFromObject(object));
animateCharacter(rig, 0); rig.root.updateMatrixWorld(true);
const rest = rig.head.matrixWorld.clone();
for (let t = 0; t < 120; t += 0.1) {
  animateCharacter(rig, t); rig.root.updateMatrixWorld(true);
  for (const lid of rig.eyelids) assert(lid.scale.y >= 0.001 && lid.scale.y <= 1, "Blink must stay within eyelid limits");
}
fixedParts.forEach((part, i) => assert(new THREE.Box3().setFromObject(part).equals(fixedBounds[i]), "Idle animation must keep the feet planted"));
animateCharacter(rig, 0); rig.root.updateMatrixWorld(true);
assert(rig.head.matrixWorld.equals(rest), "Animation must not accumulate transform drift");

for (const asset of ["body-paint.webp", "feather-paint.webp", "reference.webp"]) {
  assert(existsSync(new URL(`../public/character/${asset}`, import.meta.url)), `Missing runtime asset: ${asset}`);
}
console.log(`Character checks passed: ${meshes} batched meshes, ${triangles.toLocaleString()} triangles; finite geometry, outward normals, grounded feet, stable idle, runtime assets.`);
