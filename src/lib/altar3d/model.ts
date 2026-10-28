import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { SCULPTED_FRAME_SPECS, type SculptedFrameId } from "./sculpted-frames";
import { ALTAR_SCALE, ALTAR_Z, SCULPTED_ALTAR_URL, SCULPTED_FLAMES, onAltar, type Anchor } from "./layout";

function randomSource(seed: number) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
}

/** All repeated petals, leaves, stems and floor tiles share instanced draw calls. */
class Batch {
  private matrices: THREE.Matrix4[] = [];
  private colors: THREE.Color[] = [];
  private dummy = new THREE.Object3D();
  constructor(private geometry: THREE.BufferGeometry, private material: THREE.Material) {}
  add(position: Anchor, scale: Anchor, color: THREE.ColorRepresentation, rotation: Anchor = [0, 0, 0]) {
    this.dummy.position.set(...position); this.dummy.scale.set(...scale); this.dummy.rotation.set(...rotation);
    this.dummy.updateMatrix(); this.matrices.push(this.dummy.matrix.clone()); this.colors.push(new THREE.Color(color));
  }
  finish(parent: THREE.Object3D, shadow = true) {
    const mesh = new THREE.InstancedMesh(this.geometry, this.material, this.matrices.length);
    this.matrices.forEach((matrix, i) => { mesh.setMatrixAt(i, matrix); mesh.setColorAt(i, this.colors[i]); });
    mesh.castShadow = shadow; mesh.receiveShadow = true; parent.add(mesh);
    return mesh;
  }
}

function leafGeometry() {
  const geometry = new THREE.PlaneGeometry(1, 1, 4, 12);
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i) + .5;
    p.setXYZ(i, p.getX(i) * Math.sin(t * Math.PI), t, Math.sin(t * Math.PI) * .13 + Math.abs(p.getX(i)) * .14);
  }
  geometry.computeVertexNormals(); return geometry;
}

function clothTexture() {
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const random = randomSource(8);
  ctx.fillStyle = "#bcb7a7"; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 16000; i++) {
    ctx.fillStyle = `rgba(${random() > .5 ? "255,255,255" : "32,23,12"},${random() * .13})`;
    ctx.fillRect(random() * 256, random() * 256, 1, 1);
  }
  for (let i = 0; i < 256; i += 2) {
    ctx.fillStyle = "#ffffff15"; ctx.fillRect(i, 0, 1, 256); ctx.fillRect(0, i, 256, 1);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(4, 3); return texture;
}

export function buildAltarWorld() {
  const root = new THREE.Group();
  const random = randomSource(1783);
  const r = (min: number, max: number) => min + random() * (max - min);
  const standard = (color: THREE.ColorRepresentation, roughness = .8, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const clay = standard("#402735", .46), darkClay = standard("#261d2b", .5), wax = standard("#897181", .58);
  const plantMat = new THREE.MeshStandardMaterial({ color: "white", roughness: .72, side: THREE.DoubleSide });
  const petals = new Batch(new THREE.SphereGeometry(1, 7, 5), standard("white", .9));
  const leaves = new Batch(leafGeometry(), plantMat);
  const dahliaPetals = new Batch(leafGeometry(), new THREE.MeshStandardMaterial({ color: "white", roughness: .68, side: THREE.DoubleSide }));
  const stems = new Batch(new THREE.CylinderGeometry(1, 1, 1, 5), standard("white"));
  const fallen = new Batch(leafGeometry(), new THREE.MeshStandardMaterial({ color: "white", roughness: .92, side: THREE.DoubleSide }));
  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, p: Anchor, parent: THREE.Object3D = root) => {
    const m = new THREE.Mesh(geometry, material); m.position.set(...p); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };
  const sphere = new THREE.SphereGeometry(1, 20, 14);
  const ellipsoid = (p: Anchor, scale: Anchor, material: THREE.Material) => { const m = mesh(sphere, material, p); m.scale.set(...scale); return m; };
  const line = (a: THREE.Vector3, b: THREE.Vector3, radius: number, color: string) => {
    const mid = a.clone().add(b).multiplyScalar(.5), direction = b.clone().sub(a);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
    const e = new THREE.Euler().setFromQuaternion(q);
    stems.add(mid.toArray() as [number, number, number], [radius, direction.length(), radius], color, [e.x, e.y, e.z]);
  };
  const palette = ["#432b4d", "#58335f", "#35233f", "#65416c", "#40283f", "#502e53", "#643c68", "#766076"];

  function flower(x: number, y: number, z: number, radius: number, kind = 0) {
    const color = new THREE.Color(palette[kind % palette.length]);
    if (kind === 5 || kind === 6 || kind === 7) {
      const layers = kind === 7 ? 2 : 5;
      for (let layer = 0; layer < layers; layer++) {
        const count = kind === 7 ? 13 : 12 + layer * 5;
        const rr = radius * (.18 + layer * .15);
        for (let j = 0; j < count; j++) {
          const a = j / count * Math.PI * 2 + layer * .25;
          const size = radius * (kind === 7 ? .65 : .5);
          dahliaPetals.add([x + Math.sin(a) * rr, y + Math.cos(a) * rr, z + (layers - layer) * radius * .09],
            [size * (kind === 7 ? .45 : .58), size, radius * .8], color.clone().multiplyScalar(.72 + layer * .07), [r(-.12,.12),r(-.12,.12),-a]);
        }
      }
      for (let j = 0; j < 12; j++) {
        const a = j * 2.4, rr = Math.sqrt(j / 12) * radius * .18;
        petals.add([x + Math.sin(a)*rr,y + Math.cos(a)*rr,z + radius * .5], [radius*.055,radius*.065,radius*.06], kind === 7 ? "#685060" : "#392337");
      }
      return;
    }
    const count = kind > 4 ? 72 : 105;
    const tilt = new THREE.Euler(r(-.5, .2), r(-.5, .5), r(-.4, .4));
    for (let i = 0; i < count; i++) {
      const t = i / count, angle = i * 2.39996;
      const radial = Math.sqrt(t) * radius;
      const v = new THREE.Vector3(Math.cos(angle) * radial, Math.sin(angle) * radial, Math.sqrt(1 - t) * radius * .6).applyEuler(tilt);
      const s = radius * r(.12, .21);
      petals.add([x + v.x, y + v.y, z + v.z], [s * .9, s * 1.05, s * .65], color.clone().multiplyScalar(r(.75, 1.18)), [r(-1, 1), r(-1, 1), angle]);
    }
  }
  function sprig(base: THREE.Vector3, tip: THREE.Vector3, size = 1, flowering = true) {
    line(base, tip, .008 * size, "#302738");
    const d = tip.clone().sub(base);
    for (let j = 1; j < 8; j++) {
      const t = j / 8, p = base.clone().addScaledVector(d, t), side = j % 2 ? 1 : -1;
      const length = r(.18, .4) * size * (1 - t * .4);
      leaves.add([p.x, p.y, p.z], [.12 * size, length, .8 * size], j % 3 ? "#25202e" : "#42334b", [r(-.8, .6), r(-1.4, 1.4), side * r(.5, 1.5)]);
    }
    if (flowering) flower(tip.x, tip.y, tip.z, r(.12, .23) * size, random() > .73 ? Math.floor(r(5, 8)) : Math.floor(r(0, 4)));
  }
  function bouquet(x: number, y: number, z: number, width: number, height: number, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = r(0, Math.PI * 2), t = Math.sqrt(random());
      sprig(new THREE.Vector3(x + r(-.15, .15), y, z), new THREE.Vector3(x + Math.cos(angle) * width * t, y + r(.2, height), z + Math.sin(angle) * width * .55), r(.8, 1.3));
    }
    for (let i = 0; i < 5; i++) {
      const angle = i / 5 * Math.PI * 2;
      leaves.add([x, y + .1, z - .22], [.11, Math.min(1.35, height * r(.45, .85)), 1], "#241c2c", [r(-.5, .5), r(-1.6, 1.6), Math.sin(angle) * .7]);
    }
  }
  function vessel(x: number, y: number, z: number, scale: number, material = clay) {
    const points = [[.22, 0], [.34, .07], [.49, .35], [.47, .58], [.31, .75], [.26, .87], [.29, .91], [.28, .95], [.23, .95], [.22, .87], [.24, .77], [.38, .57], [.41, .35], [.27, .12]].map(([a, b]) => new THREE.Vector2(a * scale, b * scale));
    mesh(new THREE.LatheGeometry(points, 32), material, [x, y, z]);
    const rim = mesh(new THREE.TorusGeometry(.275 * scale, .025 * scale, 8, 32), material, [x, y + .92 * scale, z]); rim.rotation.x = Math.PI / 2;
  }

  // Broad velvet folds catch the side light; the cloth texture only adds a fine weave.
  const curtainBump = clothTexture(); curtainBump.repeat.set(16, 5);
  const curtainGeometry = new THREE.PlaneGeometry(60, 24, 800, 12);
  const curtainPositions = curtainGeometry.attributes.position;
  for (let i = 0; i < curtainPositions.count; i++) {
    const x = curtainPositions.getX(i), y = curtainPositions.getY(i);
    const fold = x * 5.6 + Math.sin(y * .13) * .12;
    curtainPositions.setZ(i, Math.sin(fold) * .18 + Math.sin(fold * 2 + .5) * .045);
  }
  curtainGeometry.computeVertexNormals();
  const curtain = mesh(curtainGeometry, new THREE.MeshStandardMaterial({ color: "#281827", roughness: .92, bumpMap: curtainBump, bumpScale: .012 }), [0, 8, -3.3]);
  curtain.castShadow = false;
  const floor = mesh(new THREE.PlaneGeometry(60, 50), standard("#120d13", .58), [0, -.045, 8]); floor.rotation.x = -Math.PI / 2;
  const tiles = new Batch(new THREE.BoxGeometry(.77, .04, .77), standard("white", .58));
  for (let x = -15; x < 16; x++) for (let z = -4; z < 15; z++) {
    const c = new THREE.Color(["#24171c", "#291b21", "#302027", "#20161e", "#2c1d24"][Math.floor(random() * 5)]).multiplyScalar(r(.7, 1.0));
    tiles.add([x * .8 + (z % 2) * .4, -.025, z * .8], [1, 1, 1], c);
  }
  tiles.finish(root, false);
  const bronze = standard("#59404d", .38, .5);

  // The sculpted altar fills the middle of the room; arrangements stand on the floor around it.
  vessel(-3.45, 0, .45, 1.05, darkClay);
  bouquet(-3.46, .65, .3, .65, 2.5, 23);
  vessel(3.4, 0, 1.25, 1.1);
  bouquet(3.4, .7, 1.24, .7, 1.6, 24);
  vessel(-2.75, 0, 2.15, .65);
  bouquet(-2.75, .4, 2.15, .45, .7, 12);
  for (let i = 0; i < 20; i++) {
    const a = r(0, Math.PI * 2), rr = r(.2, 1.1);
    flower(-3.1 + Math.cos(a) * rr, .13 + r(0, .14), 1.75 + Math.sin(a) * rr * .45, r(.10, .19), Math.floor(r(0, 4)));
  }
  // Airy branches and palm fronds silhouette against the curtain beside the arch.
  for (let i = 0; i < 5; i++) {
    const base = new THREE.Vector3(-3.4, 1.3, .1), tip = new THREE.Vector3(r(-4.3, -3.2), r(3.5, 4.9), r(-1.6, -.6));
    sprig(base, tip, 1.6, false);
    for (let j = 0; j < 4; j++) {
      const t = r(.5, 1), p = base.clone().lerp(tip, t), twig = p.clone().add(new THREE.Vector3(r(-.55, .55), r(.05, .4), r(-.1, .2)));
      line(p, twig, .006, "#483546"); flower(twig.x, twig.y, twig.z, r(.025, .055), 4);
    }
  }

  const flames: THREE.Mesh[] = [], candleLights: THREE.PointLight[] = [];
  const flameMaterial = new THREE.MeshBasicMaterial({ color: "#ffddb0", toneMapped: false });
  const glowCanvas = document.createElement("canvas"); glowCanvas.width = glowCanvas.height = 64;
  const ctx = glowCanvas.getContext("2d")!, gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255,169,62,.5)"); gradient.addColorStop(.2, "rgba(255,115,20,.16)"); gradient.addColorStop(1, "rgba(255,100,10,0)");
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64);
  const glowTexture = new THREE.CanvasTexture(glowCanvas);
  function flameAt(p: Anchor, lit: boolean) {
    const flame = ellipsoid(p, [.035, .092, .035], flameMaterial); flame.castShadow = false; flames.push(flame);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color: "#ffac56", transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    halo.position.copy(flame.position); halo.scale.set(.9, .9, 1); root.add(halo);
    if (lit) { const light = new THREE.PointLight("#ff9c40", 5, 3, 2); light.position.copy(flame.position); root.add(light); candleLights.push(light); }
  }
  function candle(x: number, y: number, z: number, height: number, radius = .09, lit = false) {
    mesh(new THREE.CylinderGeometry(radius, radius * 1.01, height, 20), wax, [x, y + height / 2, z]);
    const top = mesh(new THREE.CylinderGeometry(radius * .82, radius * .9, .018, 20), standard("#554050"), [x, y + height, z]); top.castShadow = false;
    mesh(new THREE.CylinderGeometry(.008, .008, .06, 5), darkClay, [x, y + height + .025, z]);
    flameAt([x, y + height + .105, z], lit);
    if (height < .45) {
      const glass = mesh(new THREE.CylinderGeometry(radius * 1.23, radius * 1.23, height + .12, 20, 1, true), new THREE.MeshPhysicalMaterial({ color: "#91738e", transparent: true, opacity: .22, roughness: .15, metalness: .12, side: THREE.DoubleSide }), [x, y + height / 2 + .04, z]); glass.castShadow = false;
    }
  }
  // The sculpted candles only need their flames; the rest stand on the floor in front.
  // Both pairs light the wood locally, with no broad amber wash across the room.
  SCULPTED_FLAMES.forEach((p) => flameAt(p, true));
  for (const [x, y, z, h] of [ [-3.0,0,1.35,.8], [-2.55,0,1.7,.38], [2.95,0,.6,.65], [2.75,0,1.45,.32], [-1.2,0,2,.48], [-.8,0,2.15,.3], [1.2,0,2.4,.6], [.9,0,2.7,.32], [.2,0,3.1,.48], [.18,0,3.7,.25] ]) candle(x, y, z, h, h > .5 ? .105 : .085, [4,8,10,12].includes(flames.length));

  // A copal burner and spare pots sit on the floor.
  vessel(1.48, 0, 2, .4, darkClay);
  vessel(2.5, 0, 2.2, .55);
  // Individual petals form a loose path, with dense banks along the altar's front step.
  for (let i = 0; i < 750; i++) {
    const path = i > 500;
    const z = path ? r(1.6, 5) : r(1.1, 2.8);
    const x = path ? Math.sin(z * .8) * .3 + r(-.34, .34) * (1 + (z - 1.6) * .3) : r(-3.3, 3.2);
    fallen.add([x, .025 + r(0, .028), z], [r(.024, .06), r(.04, .1), .035], palette[Math.floor(r(0, 4))], [-Math.PI / 2 + r(-.2,.2), r(-.3,.3), r(0,6.28)]);
  }

  // Pierced papel picado, cut through rather than printed onto rectangles.
  const cord = new THREE.CatmullRomCurve3(Array.from({length: 21}, (_, i) => new THREE.Vector3(-5 + i * .5, 7.35 - Math.sin(i / 20 * Math.PI) * .65, -1.7)));
  mesh(new THREE.TubeGeometry(cord, 40, .008, 4, false), bronze, [0,0,0]);
  for (let i = 0; i < 13; i++) {
    const flag = new THREE.Shape(); flag.moveTo(-.28,0); flag.lineTo(.28,0); flag.lineTo(.28,-.51);
    for(let j = 8; j >= 0; j--) flag.lineTo(-.28 + j * .07, -.51 - (j % 2 ? .055 : 0));
    flag.closePath();
    const center = new THREE.Path(); center.absarc(0,-.235,.032,0,Math.PI*2,true); flag.holes.push(center);
    for (let petal = 0; petal < 8; petal++) {
      const a = petal / 8 * Math.PI * 2;
      const hole = new THREE.Path(); hole.absellipse(Math.sin(a)*.086,-.235 + Math.cos(a)*.086,.021,.045,0,Math.PI*2,true,-a); flag.holes.push(hole);
    }
    for (const side of [-1,1]) for (let row = 0; row < 5; row++) {
      const x = side*.23, y = -.06-row*.09;
      const hole = new THREE.Path(); hole.moveTo(x,y+.016); hole.lineTo(x+.016,y); hole.lineTo(x,y-.016); hole.lineTo(x-.016,y); hole.closePath(); flag.holes.push(hole);
    }
    for (const x of [-.11,0,.11]) {
      const hole = new THREE.Path(); hole.absellipse(x,-.445,.018,.025,0,Math.PI*2,true,0); flag.holes.push(hole);
    }
    const x = -4.5 + i * .65;
    const f = mesh(new THREE.ExtrudeGeometry(flag, {depth:.008,bevelEnabled:false}), new THREE.MeshStandardMaterial({color: ["#50334f","#6a5268","#38273f","#493152"][i%4], side: THREE.DoubleSide, roughness: 1}), [x,7.35 - Math.sin((x+5)/10*Math.PI)*.65,-1.7]);
    f.rotation.set(.1, r(-.3,.3), r(-.08,.08));
  }
  // Ambient shafts remain behind the altar; there are no wall-mounted lights.
  const beamCanvas = document.createElement("canvas"); beamCanvas.width = 128; beamCanvas.height = 512;
  const beamContext = beamCanvas.getContext("2d")!;
  for (let y = 0; y < 512; y++) {
    const t = y / 512, spread = 8 + t * 55;
    const gradient = beamContext.createLinearGradient(64 - spread, 0, 64 + spread, 0);
    const alpha = (1 - t) * .065;
    gradient.addColorStop(0, "rgba(255,255,255,0)"); gradient.addColorStop(.4, `rgba(255,255,255,${alpha})`);
    gradient.addColorStop(.6, `rgba(255,255,255,${alpha})`); gradient.addColorStop(1, "rgba(255,255,255,0)");
    beamContext.fillStyle = gradient; beamContext.fillRect(0, y, 128, 1);
  }
  const beamTexture = new THREE.CanvasTexture(beamCanvas);
  for (const [x, angle, color] of [[2.5, -.3, "#a352ed"], [-2.6, .25, "#7139c7"]] as const) {
    const beam = mesh(new THREE.PlaneGeometry(3, 7.5), new THREE.MeshBasicMaterial({ map: beamTexture, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), [x, 4, -2.2]);
    beam.rotation.z = angle; beam.castShadow = false;
  }
  petals.finish(root); dahliaPetals.finish(root); leaves.finish(root); stems.finish(root); fallen.finish(root, false);
  return { root, flames, candleLights, textures: [glowTexture, curtainBump, beamTexture] };
}

/** The hand-painted ofrenda sculpt (see scripts/convert-altar-stl.mts), placed in scene units. */
export async function loadSculptedAltar(url = SCULPTED_ALTAR_URL) {
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url);
  const root = new THREE.Group(); root.name = "Sculpted altar and independent portraits";
  const frames = new Map<SculptedFrameId, THREE.Group>();
  const material = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: .48, clearcoat: .18, clearcoatRoughness: .42 });
  const geometries = new Set<THREE.BufferGeometry>(), importedMaterials = new Set<THREE.Material>();
  gltf.scene.traverse(node => {
    if (node instanceof THREE.Mesh) {
      geometries.add(node.geometry);
      (Array.isArray(node.material) ? node.material : [node.material]).forEach(m => importedMaterials.add(m));
    }
  });
  importedMaterials.forEach(m => m.dispose());
  function dispose() { geometries.forEach(g => g.dispose()); material.dispose(); }
  function sculpt(name: string) {
    const source = gltf.scene.getObjectByName(name);
    if (!(source instanceof THREE.Mesh)) { dispose(); throw new Error(`Missing sculpt part: ${name}`); }
    if (!source.geometry.hasAttribute("normal")) source.geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(source.geometry, material); mesh.name = name;
    mesh.castShadow = mesh.receiveShadow = true;
    return mesh;
  }
  const body = sculpt("altar-body"); body.scale.setScalar(ALTAR_SCALE); body.position.z = ALTAR_Z; root.add(body);
  for (const spec of SCULPTED_FRAME_SPECS) {
    const group = new THREE.Group(); group.name = spec.id;
    group.position.set(...onAltar(...spec.pivot)); group.scale.setScalar(ALTAR_SCALE); group.visible = false;
    group.add(sculpt(spec.id)); root.add(group); frames.set(spec.id, group);
  }
  return { root, frames, dispose };
}
