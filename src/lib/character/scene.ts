import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { buildCharacter, type CharacterRig } from "./model";
import { animateCharacter } from "./animation";
import { seededRandom } from "./geometry";

export type CharacterView = "portrait" | "front" | "left" | "right" | "back";
export type SceneStatus = "loading" | "ready" | "error";
export interface SceneOptions {
  animated: boolean;
  interactive: boolean;
  onStatus: (status: SceneStatus) => void;
}

function disposeTree(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      geometries.add(object.geometry);
      (Array.isArray(object.material) ? object.material : [object.material]).forEach((m) => materials.add(m));
    }
  });
  geometries.forEach((g) => g.dispose()); materials.forEach((m) => m.dispose());
}

export function createCharacterScene(host: HTMLElement, options: SceneOptions) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
  renderer.setClearColor(0xf7efdf, 0);
  const canvas = renderer.domElement;
  canvas.setAttribute("aria-label", "Three-dimensional painted alpaca alebrije. Use the view controls to inspect it.");
  canvas.setAttribute("role", "img");
  canvas.style.width = "100%"; canvas.style.height = "100%"; canvas.style.display = "block";
  host.appendChild(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 80);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 3.08, -0.1);
  controls.enablePan = false; controls.enableDamping = false;
  controls.minPolarAngle = Math.PI * 0.20; controls.maxPolarAngle = Math.PI * 0.66;
  controls.enabled = options.interactive; controls.zoomSpeed = 0.65; controls.rotateSpeed = 0.65;
  const hemisphere = new THREE.HemisphereLight(0xfff0d7, 0x9a7355, 2.25); scene.add(hemisphere);
  const key = new THREE.DirectionalLight(0xffedd1, 3.1); key.position.set(-3, 8, 6);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -5; key.shadow.camera.right = 5; key.shadow.camera.top = 7; key.shadow.camera.bottom = -4;
  key.shadow.normalBias = 0.025; key.shadow.bias = -0.00015;
  key.target.position.set(0, 3, 0); scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0xd7e6e0, 1.2); fill.position.set(5, 4, -4); scene.add(fill);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ color: 0x624128, opacity: 0.16 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = 0.005; floor.receiveShadow = true; scene.add(floor);

  const random = seededRandom(23), noise = new Uint8Array(128 * 128 * 4);
  for (let i = 0; i < noise.length; i += 4) {
    const n = Math.round(110 + random() * 65);
    noise[i] = n; noise[i + 1] = n; noise[i + 2] = n; noise[i + 3] = 255;
  }
  const grain = new THREE.DataTexture(noise, 128, 128);
  grain.wrapS = grain.wrapT = THREE.RepeatWrapping; grain.repeat.set(7, 7);
  grain.magFilter = THREE.LinearFilter; grain.needsUpdate = true;
  const textures: THREE.Texture[] = [grain];
  let disposed = false, failed = false, rig: CharacterRig | undefined;
  let animated = options.animated, inViewport = true, frame = 0, previous = 0, elapsed = 0;
  let sampleStart = 0, sampleFrames = 0;
  let currentView: CharacterView = "portrait", distance = 14;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function render() { if (!disposed && !failed && rig) renderer.render(scene, camera); }
  function canAnimate() { return !disposed && !failed && !!rig && animated && !reducedMotion.matches && !document.hidden && inViewport; }
  function tick(now: number) {
    frame = 0;
    if (!canAnimate()) return;
    if (previous && now - previous < 15.7) { frame = requestAnimationFrame(tick); return; }
    elapsed += previous ? Math.min((now - previous) / 1000, 0.05) : 0; previous = now;
    animateCharacter(rig!, elapsed); render();
    if (process.env.NODE_ENV === "development") {
      if (!sampleStart) sampleStart = now;
      sampleFrames++;
      if (now - sampleStart >= 1000) {
        canvas.dataset.renderFps = (sampleFrames * 1000 / (now - sampleStart)).toFixed(1);
        canvas.dataset.drawCalls = String(renderer.info.render.calls);
        canvas.dataset.triangles = String(renderer.info.render.triangles);
        sampleStart = now; sampleFrames = 0;
      }
    }
    frame = requestAnimationFrame(tick);
  }
  function syncAnimation() {
    cancelAnimationFrame(frame); frame = 0; previous = 0; sampleStart = 0; sampleFrames = 0;
    if ((!animated || reducedMotion.matches) && rig) { animateCharacter(rig, 0); elapsed = 0; }
    if (canAnimate()) frame = requestAnimationFrame(tick);
    if (!document.hidden && inViewport) render();
  }
  function setView(view: CharacterView) {
    currentView = view;
    const angle = { portrait: -0.48, front: 0, left: -Math.PI / 2, right: Math.PI / 2, back: Math.PI }[view];
    camera.position.set(Math.sin(angle) * distance, 3.08 + distance * 0.09, Math.cos(angle) * distance - 0.1);
    controls.target.set(0, 3.08, -0.1); controls.update(); render();
  }
  function resize() {
    const width = host.clientWidth, height = host.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height; camera.updateProjectionMatrix();
    distance = Math.max(7.8 / (2 * Math.tan(THREE.MathUtils.degToRad(17))), 6.35 / (2 * Math.tan(THREE.MathUtils.degToRad(17)) * camera.aspect));
    controls.minDistance = distance * 0.5; controls.maxDistance = distance * 1.7;
    setView(currentView);
  }
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host);
  const visibilityObserver = new IntersectionObserver(([entry]) => { inViewport = entry.isIntersecting; syncAnimation(); });
  visibilityObserver.observe(host);
  controls.addEventListener("change", render);
  document.addEventListener("visibilitychange", syncAnimation);
  reducedMotion.addEventListener("change", syncAnimation);
  function contextLost(event: Event) {
    event.preventDefault(); failed = true; cancelAnimationFrame(frame); options.onStatus("error");
  }
  canvas.addEventListener("webglcontextlost", contextLost);

  const loader = new THREE.TextureLoader();
  function load(url: string) {
    return loader.loadAsync(url).then((texture) => {
      if (disposed) { texture.dispose(); return texture; }
      textures.push(texture);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      return texture;
    });
  }
  resize();
  Promise.all([load("/character/body-paint.webp"), load("/character/feather-paint.webp")]).then(([body, feather]) => {
    if (disposed || failed) return;
    rig = buildCharacter(body, feather, grain); scene.add(rig.root);
    render(); options.onStatus("ready"); syncAnimation();
  }).catch((error: unknown) => {
    if (!disposed) { failed = true; console.error("Character scene could not load", error); options.onStatus("error"); }
  });

  return {
    setView,
    setAnimated(value: boolean) { animated = value; syncAnimation(); },
    setInteractive(value: boolean) { controls.enabled = value; },
    zoom(factor: number) {
      const offset = camera.position.clone().sub(controls.target);
      offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance));
      camera.position.copy(controls.target).add(offset); controls.update(); render();
    },
    dispose() {
      disposed = true; cancelAnimationFrame(frame);
      resizeObserver.disconnect(); visibilityObserver.disconnect();
      document.removeEventListener("visibilitychange", syncAnimation);
      reducedMotion.removeEventListener("change", syncAnimation);
      canvas.removeEventListener("webglcontextlost", contextLost);
      controls.removeEventListener("change", render); controls.dispose();
      disposeTree(scene); textures.forEach((texture) => texture.dispose());
      key.shadow.dispose(); renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
    },
  };
}

export type CharacterScene = ReturnType<typeof createCharacterScene>;
