import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { featherGeometry, neckGeometry, neckSample, seededRandom } from "./geometry.ts";

export interface CharacterRig {
  root: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  wings: THREE.Group[];
  tail: THREE.Group;
  eyes: THREE.Group[];
  eyelids: THREE.Group[];
}

type Point = [number, number, number];
const C = { cream: "#f4d8a0", light: "#ffe6b8", ochre: "#d48323", orange: "#ec6e13", rust: "#ae3927", teal: "#28746e", brown: "#6a3421", dark: "#301b12", rose: "#a85d47" };

/** Bake static parts together by material; animation joints stay separate. */
function batch(group: THREE.Group) {
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const meshes = group.children.filter((c): c is THREE.Mesh => c instanceof THREE.Mesh);
  for (const mesh of meshes) {
    mesh.updateMatrix();
    const geo = mesh.geometry.clone().applyMatrix4(mesh.matrix);
    const material = mesh.material as THREE.Material;
    const list = buckets.get(material) ?? [];
    list.push(geo); buckets.set(material, list);
    mesh.geometry.dispose(); group.remove(mesh);
  }
  for (const [material, geos] of buckets) {
    const merged = mergeGeometries(geos);
    geos.forEach((g) => g.dispose());
    if (merged) {
      const mesh = new THREE.Mesh(merged, material);
      mesh.castShadow = true; mesh.receiveShadow = true;
      group.add(mesh);
    }
  }
}

export function buildCharacter(bodyTexture: THREE.Texture, featherTexture: THREE.Texture, grain: THREE.Texture): CharacterRig {
  const root = new THREE.Group(); root.name = "alebrije";
  const torso = new THREE.Group(); torso.name = "breathing-torso"; root.add(torso);
  const mats = new Map<string, THREE.MeshStandardMaterial>();
  function matte(color: string) {
    if (!mats.has(color)) mats.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.86, bumpMap: grain, bumpScale: 0.018 }));
    return mats.get(color)!;
  }
  const paint = new THREE.MeshStandardMaterial({ map: bodyTexture, roughness: 0.88, bumpMap: grain, bumpScale: 0.022 });
  const wingPaint = new THREE.MeshStandardMaterial({ map: featherTexture, color: "#f4cc8b", roughness: 0.86, bumpMap: grain, bumpScale: 0.015 });
  const cream = matte(C.cream), pale = matte(C.light), dark = matte(C.dark);
  function mesh(parent: THREE.Group, geometry: THREE.BufferGeometry, material: THREE.Material, at: Point = [0, 0, 0]) {
    const result = new THREE.Mesh(geometry, material); result.position.set(...at);
    result.castShadow = true; result.receiveShadow = true; parent.add(result); return result;
  }
  function ellipsoid(parent: THREE.Group, at: Point, scale: Point, material: THREE.Material) {
    const size = Math.max(...scale);
    const segments = size < 0.12 ? [12, 8] : size < 0.28 ? [20, 12] : [32, 24];
    const m = mesh(parent, new THREE.SphereGeometry(1, segments[0], segments[1]), material, at); m.scale.set(...scale); return m;
  }
  function tube(parent: THREE.Group, points: Point[], radius: number, material: THREE.Material, segments = 20) {
    return mesh(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), segments, radius, 8, false), material);
  }
  function feather(parent: THREE.Group, from: Point, to: Point, width: number, material: THREE.Material, bend = 0.08, roll = 0) {
    const delta = new THREE.Vector3(...to).sub(new THREE.Vector3(...from));
    const geometry = featherGeometry(delta.length(), width, bend);
    if (material === wingPaint) {
      const uv = geometry.getAttribute("uv");
      const offset = Math.abs(to[0] * 0.27 + to[1] * 0.13) % 0.65;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.34 + offset, uv.getY(i) * 0.62);
    }
    const m = mesh(parent, geometry, material, from);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    m.rotateY(roll); return m;
  }

  // Plump horizontal torso, with the neck seated deeply into the chest.
  const body = ellipsoid(torso, [0, 2.75, -0.34], [0.90, 0.98, 1.17], paint);
  const bp = body.geometry.getAttribute("position");
  for (let i = 0; i < bp.count; i++) {
    const d = 1 + 0.008 * Math.sin(bp.getY(i) * 33 + bp.getX(i) * 19) * Math.cos(bp.getZ(i) * 23);
    bp.setXYZ(i, bp.getX(i) * d, bp.getY(i) * d, bp.getZ(i) * d);
  }
  body.geometry.computeVertexNormals();
  mesh(torso, neckGeometry(), paint);

  // Cream breast fleece: staggered tapered carved locks, open at the painted flanks.
  const random = seededRandom(17);
  for (let row = 0; row < 23; row++) {
    const t = 0.03 + row / 23 * 0.92;
    const { center, radius } = neckSample(t);
    const y = center.y, zc = center.z;
    const count = row < 8 ? 15 : 11;
    for (let k = 0; k < count; k++) {
      const a = (k / (count - 1) - 0.5) * 1.65 + (random() - 0.5) * 0.07;
      const x = Math.sin(a) * radius, z = zc + Math.cos(a) * radius * 1.08;
      if (t > 0.97) continue;
      const len = 0.25 + random() * 0.14, stagger = (random() - 0.5) * 0.07;
      feather(torso, [x, y + stagger + 0.06, z - 0.012], [x + x * 0.03, y + stagger + 0.06 - len, z + 0.018], 0.025 + random() * 0.018, k % 4 ? cream : pale, 0.006, Math.PI);
    }
  }
  // Carved locks break up the body silhouette without obscuring the floral sides.
  for (let i = 0; i < 105; i++) {
    const a = random() * Math.PI * 2, y = 1.98 + random() * 0.55;
    const section = Math.sqrt(Math.max(0.1, 1 - ((y - 2.75) / 0.96) ** 2));
    const x = Math.cos(a) * 0.89 * section, z = -0.34 + Math.sin(a) * 1.16 * section;
    feather(torso, [x, y + 0.1, z], [x * 1.035, y - 0.12, z * 1.02], 0.05, cream, 0.015, Math.PI);
  }

  // Two articulated-looking bird legs, fixed in the idle pose.
  for (const s of [-1, 1]) {
    const x = s * 0.44;
    ellipsoid(root, [x, 2.05, -0.15], [0.25, 0.37, 0.31], paint);
    tube(root, [[x, 2.12, -0.1], [x * 1.08, 1.65, 0.03], [x * 1.08, 1.42, -0.18]], 0.105, matte(C.brown));
    ellipsoid(root, [x * 1.08, 1.42, -0.18], [0.115, 0.15, 0.12], matte(C.ochre));
    tube(root, [[x * 1.08, 1.44, -0.18], [x * 1.1, 0.85, 0.03], [x * 1.13, 0.20, 0.23]], 0.073, matte(C.brown));
    for (let j = 0; j < 12; j++) {
      const t = j / 12;
      ellipsoid(root, [x * 1.1, 0.36 + t * 0.91, 0.29 - t * 0.32], [0.066, 0.032, 0.027], matte(j % 4 === 0 ? C.teal : j % 3 === 0 ? C.orange : C.ochre));
    }
    for (let toe = -1; toe <= 1; toe++) {
      const tip: Point = [x * 1.13 + toe * 0.20, 0.075, 0.81 - Math.abs(toe) * 0.10];
      tube(root, [[x * 1.13, 0.21, 0.22], [x * 1.13 + toe * 0.12, 0.105, 0.52], tip], 0.065, matte(C.brown));
      feather(root, tip, [tip[0] + toe * 0.035, 0.045, tip[2] + 0.16], 0.058, dark, 0);
      for (let j = 0; j < 4; j++) ellipsoid(root, [x * 1.13 + toe * (0.07 + j * 0.03), 0.16 - j * 0.012, 0.38 + j * 0.09], [0.062, 0.019, 0.027], matte(C.ochre));
    }
    tube(root, [[x * 1.13, 0.18, 0.23], [x * 1.13 + s * 0.04, 0.08, -0.04], [x * 1.13 + s * 0.08, 0.06, -0.18]], 0.043, matte(C.brown));
  }

  const wings: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const wing = new THREE.Group(); wing.name = s < 0 ? "left-wing" : "right-wing";
    wing.position.set(s * 0.62, 3.03, -0.43);
    wing.rotation.y = s < 0 ? -0.45 : 0.25;
    wing.rotation.z = s > 0 ? -0.23 : 0;
    torso.add(wing); wings.push(wing);
    // Broad fan, long primaries above shorter trailing feathers.
    for (let i = 0; i < 12; i++) {
      const t = i / 11;
      feather(wing, [s * (0.12 + t * 0.27), 0.18 + t * 0.70, -0.05],
        [s * (1.24 + Math.sin(t * 2.3) * 0.72), 0.14 + t * 2.50, -0.20 - t * 0.08],
        0.20 + t * 0.055, i % 4 === 0 ? matte(C.rust) : wingPaint, s * 0.1);
    }
    for (let i = 0; i < 10; i++) {
      const t = i / 9;
      feather(wing, [s * 0.08, 0.15 + t * 0.6, 0.075],
        [s * (0.94 + Math.sin(t * 2.2) * 0.39), 0.18 + t * 2.10, 0.08],
        0.16, i % 3 ? matte(C.teal) : matte(C.rust), s * 0.08);
    }
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      feather(wing, [s * 0.04, 0.1 + t * 0.45, 0.16],
        [s * (0.62 + t * 0.45), 0.24 + t * 1.75, 0.18],
        0.15, wingPaint, s * 0.09);
    }
    tube(wing, [[0, 0, 0.12], [s * 0.37, 0.51, 0.18], [s * 0.58, 1.15, 0.14], [s * 0.84, 1.82, 0.1]], 0.13, wingPaint);
    // A painted flower on each wing's shoulder, carried by curved feather surfaces.
    for (let j = 0; j < 8; j++) {
      const a = j / 8 * Math.PI * 2;
      feather(wing, [s * 0.65, 1.28, 0.25], [s * 0.65 + Math.cos(a) * 0.39, 1.28 + Math.sin(a) * 0.39, 0.25], 0.085, matte(C.rust), 0);
      feather(wing, [s * 0.65, 1.28, 0.28], [s * 0.65 + Math.cos(a) * 0.27, 1.28 + Math.sin(a) * 0.27, 0.28], 0.042, matte(C.ochre), 0);
    }
    ellipsoid(wing, [s * 0.65, 1.28, 0.30], [0.10, 0.10, 0.025], pale);
    batch(wing);
  }

  const tail = new THREE.Group(); tail.name = "feather-tail"; tail.position.set(0, 3.0, -1.25); torso.add(tail);
  for (let i = 0; i < 19; i++) {
    const a = (i / 18 - 0.5) * 2.6;
    const length = 0.90 + (i % 4) * 0.14;
    feather(tail, [0, 0, 0], [Math.sin(a) * length * 0.85, -0.16 - Math.cos(a) * length * 0.72 - (i % 3) * 0.15, -0.45 - Math.cos(a) * length * 0.65], 0.15,
      i % 5 === 0 ? matte(C.teal) : i % 3 === 0 ? matte(C.rust) : wingPaint, 0.27, a * 0.4);
  }
  batch(tail);

  const head = new THREE.Group(); head.name = "head"; head.position.set(0, 4.83, 0.77); head.scale.setScalar(1.10); torso.add(head);
  ellipsoid(head, [0, 0.25, 0], [0.38, 0.49, 0.43], cream);
  for (let row = 0; row < 7; row++) {
    const y = -0.10 + row * 0.10;
    const radius = Math.sqrt(Math.max(0.1, 1 - ((y - 0.25) / 0.49) ** 2));
    for (let k = 0; k < 9; k++) {
      const a = Math.PI + (k / 8 - 0.5) * 2.5;
      const x = Math.sin(a) * 0.38 * radius, z = Math.cos(a) * 0.43 * radius;
      feather(head, [x, y + 0.07, z], [x * 1.05, y - 0.14 - random() * 0.10, z - 0.025], 0.034, cream, 0.005);
    }
  }
  ellipsoid(head, [0, 0.02, 0.20], [0.34, 0.30, 0.36], cream);
  ellipsoid(head, [0, 0.08, 0.40], [0.30, 0.24, 0.28], pale);
  for (const s of [-1, 1]) {
    ellipsoid(head, [s * 0.13, 0.02, 0.52], [0.16, 0.145, 0.16], cream);
    // Tall open ears, outer rim and inset bowl have genuine curved thickness.
    const ear = feather(head, [s * 0.24, 0.52, -0.09], [s * 0.56, 1.35, -0.16], 0.20, cream, s * 0.07);
    ear.rotation.y = s * -0.20;
    feather(head, [s * 0.27, 0.61, -0.045], [s * 0.55, 1.26, -0.09], 0.145, matte(C.rust), s * 0.06);
    feather(head, [s * 0.29, 0.65, 0.005], [s * 0.49, 1.08, -0.01], 0.085, matte(C.rose), s * 0.045);
    for (let i = 0; i < 7; i++) {
      const y = -0.12 + i * 0.055;
      feather(head, [s * 0.27, y + 0.12, -0.14], [s * (0.40 + (i % 3) * 0.025), y - 0.06, -0.23], 0.06, cream, 0.01);
    }
  }
  // Heart-shaped nose and a small upturned, closed mouth.
  ellipsoid(head, [-0.069, 0.16, 0.635], [0.105, 0.068, 0.055], matte(C.rose));
  ellipsoid(head, [0.069, 0.16, 0.635], [0.105, 0.068, 0.055], matte(C.rose));
  ellipsoid(head, [0, 0.114, 0.66], [0.069, 0.068, 0.035], matte(C.brown));
  for (const s of [-1, 1]) {
    ellipsoid(head, [s * 0.087, 0.15, 0.68], [0.037, 0.018, 0.008], dark);
    tube(head, [[0, 0.07, 0.664], [s * 0.07, -0.075, 0.652], [s * 0.19, -0.085, 0.579], [s * 0.25, -0.035, 0.51]], 0.012, matte(C.brown));
  }
  const eyes: THREE.Group[] = [], eyelids: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const socket = new THREE.Group(); socket.position.set(s * 0.285, 0.32, 0.29); socket.rotation.y = s * 0.54; head.add(socket);
    ellipsoid(socket, [0, 0, 0], [0.176, 0.211, 0.067], matte(C.ochre));
    ellipsoid(socket, [0, -0.003, 0.025], [0.153, 0.185, 0.060], dark);
    const eye = new THREE.Group(); eye.name = "blinking-eye"; socket.add(eye); eyes.push(eye);
    ellipsoid(eye, [0, 0, 0.05], [0.135, 0.163, 0.065], pale);
    const irisMat = new THREE.MeshStandardMaterial({ color: "#934509", roughness: 0.34 });
    ellipsoid(eye, [-s * 0.016, -0.008, 0.105], [0.103, 0.134, 0.042], irisMat);
    ellipsoid(eye, [-s * 0.017, 0.007, 0.14], [0.061, 0.100, 0.026], dark);
    ellipsoid(eye, [-0.034, 0.065, 0.163], [0.031, 0.038, 0.010], pale);
    ellipsoid(eye, [0.035, -0.049, 0.159], [0.012, 0.016, 0.008], pale);
    const lid = new THREE.Group(); lid.name = "upper-eyelid"; lid.position.set(0, 0.18, 0.12);
    ellipsoid(lid, [0, -0.18, 0], [0.154, 0.184, 0.072], cream);
    lid.visible = false; socket.add(lid); eyelids.push(lid); batch(lid);
    tube(socket, [[-0.15, 0.07, 0.05], [-0.11, 0.17, 0.06], [0.015, 0.20, 0.05], [0.14, 0.12, 0.02]], 0.024, matte(C.brown));
    tube(head, [[s * 0.15, 0.63, 0.22], [s * 0.25, 0.66, 0.26], [s * 0.36, 0.58, 0.19]], 0.033, matte(C.brown));
    // Small cheek flower and freckles are curved along the cheek surface.
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      const petal = ellipsoid(head, [s * (0.33 + Math.cos(a) * 0.075), 0.02 + Math.sin(a) * 0.09, 0.30 - Math.cos(a) * 0.028], [0.026, 0.056, 0.013], matte(C.orange));
      petal.rotation.z = -a + Math.PI / 2;
    }
    ellipsoid(head, [s * 0.33, 0.02, 0.32], [0.03, 0.03, 0.014], matte(C.rust));
    for (let i = 0; i < 6; i++) ellipsoid(head, [s * (0.20 + (i % 3) * 0.045), 0.11 + Math.floor(i / 3) * 0.055, 0.39 - (i % 3) * 0.012], [0.011, 0.014, 0.009], matte(C.rust));
    batch(eye); batch(socket);
  }
  // Cockatiel-like crest sweeps backward, away from the face.
  for (let i = 0; i < 11; i++) {
    const s = i % 2 ? -1 : 1, t = i / 10;
    feather(head, [s * 0.07, 0.61, -0.16], [s * (0.10 + t * 0.21), 1.27 - t * 0.16, -0.30 - t * 0.37], 0.075,
      i % 4 === 0 ? matte(C.teal) : i % 3 === 0 ? matte(C.rust) : matte(C.orange), -0.10);
  }
  for (let i = 0; i < 5; i++) ellipsoid(head, [(i - 2) * 0.046, 0.63 - Math.abs(i - 2) * 0.026, 0.265], [0.013, 0.024, 0.01], matte(i % 2 ? C.orange : C.rust));
  batch(head); batch(torso); batch(root);
  root.updateMatrixWorld(true);
  return { root, torso, head, wings, tail, eyes, eyelids };
}
