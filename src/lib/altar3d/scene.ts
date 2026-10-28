import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { buildAltarWorld, loadSculptedAltar } from "./model";
import { placeSculptedFrames } from "./sculpted-portraits";
import { createPortraitFrames } from "./portrait-frame";
import type { Anchor, PortraitFrame, SculptedPortrait } from "./layout";

export type SpatialItem = { element: HTMLElement; point: Anchor; width: number; portraitFrame?: PortraitFrame; sculptedFrame?: SculptedPortrait };

/** How far the camera frames in past a snug fit of the altar. */
const VIEW_ZOOM = 1.28;
/** World height (near the altar crest) that keeps its screen position as the view zooms. */
const ZOOM_ANCHOR_Y = 4.3;

export function createAltarScene(host: HTMLElement, onReady: () => void, onError: () => void) {
  // The composer renders offscreen, so a multisampled canvas would only cost memory.
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
  renderer.setClearColor("#100b16");
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2("#100b16", .016);
  const camera = new THREE.OrthographicCamera(-7, 7, 4.2, -4.2, .1, 80);
  const world = buildAltarWorld(); scene.add(world.root);
  const portraitFrames = createPortraitFrames();
  let sculptedAltar: Awaited<ReturnType<typeof loadSculptedAltar>> | undefined;
  const photoTopLeft = new THREE.Vector3(), photoTopRight = new THREE.Vector3(), photoBottomLeft = new THREE.Vector3();
  const frames = new Map<HTMLElement, { group: THREE.Group; signature: string }>();
  // The room waits for the sculpted altar so its candle flames never float on their own.
  world.root.visible = false;
  scene.add(new THREE.HemisphereLight("#9275b5", "#28131d", .38));
  const key = new THREE.DirectionalLight("#c5a6d8", 1.3);
  key.position.set(-3.5, 7, 5); key.target.position.set(0, 2, 0); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = -7; key.shadow.camera.right = 7;
  key.shadow.camera.top = 8; key.shadow.camera.bottom = -6; key.shadow.normalBias = .025;
  key.shadow.bias = -.00015; key.shadow.radius = 3; scene.add(key, key.target);
  const rim = new THREE.DirectionalLight("#a24bff", 3.2); rim.position.set(4, 4, -2); scene.add(rim);
  const violet = new THREE.SpotLight("#963cff", 62, 18, .68, .9, 1.7);
  violet.position.set(-4.5, 3.8, 1); violet.target.position.set(-1, 3, -2.8); scene.add(violet, violet.target);
  const purple = new THREE.SpotLight("#ad57fa", 52, 18, .62, .9, 1.7);
  purple.position.set(4.5, 5.5, 1); purple.target.position.set(1.5, 3.5, -2.7); scene.add(purple, purple.target);
  // The single portrait moves beyond the candle lights, so bring a soft warm fill with it.
  const portraitLight = new THREE.SpotLight("#ffc783", 24, 6, .62, .85, 2);
  portraitLight.visible = false; scene.add(portraitLight, portraitLight.target);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), .28, .55, 1.1); composer.addPass(bloom); composer.addPass(new OutputPass());
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  let width = 0, height = 0, frame = 0, disposed = false, visible = true, lost = false;
  let shift = 0, targetY = 3.15, scale = 1, lastTime = 0, available = 0;
  const turnLimit = THREE.MathUtils.degToRad(15);
  let yaw = 0, hoverYaw = 0, hoverPitch = 0, easedYaw = 0, easedPitch = 0;
  let gesture: { id: number; x: number; y: number; yaw: number; dragged: boolean } | null = null;
  let suppressDragClick = false;
  const orbit = new THREE.Quaternion(), angles = new THREE.Euler(0, 0, 0, "YXZ");
  const lookTarget = new THREE.Vector3(), pivot = new THREE.Vector3();
  let items: SpatialItem[] = [];
  const projected = new THREE.Vector3();
  const origin = new THREE.Vector2(), right = new THREE.Vector2(), bottom = new THREE.Vector2();
  let itemsPending = false;
  function project(x: number, y: number, z: number, target: THREE.Vector2) {
    projected.set(x, y, z).project(camera);
    target.set((projected.x * .5 + .5) * width, (-projected.y * .5 + .5) * height);
  }
  function syncFrames() {
    const active = new Set<HTMLElement>();
    if (sculptedAltar) placeSculptedFrames(sculptedAltar.frames, items);
    portraitLight.visible = false;
    for (const item of items) {
      if (item.sculptedFrame && item.sculptedFrame.scale > 1) {
        const [x, y, z] = item.point;
        portraitLight.visible = true; portraitLight.position.set(x - .9, y + 1.3, z + 1.8);
        portraitLight.target.position.set(x, y + .8, z - .1); portraitLight.target.updateMatrixWorld();
      }
      if (!item.portraitFrame) continue;
      active.add(item.element);
      const signature = JSON.stringify([item.width, item.portraitFrame]);
      let entry = frames.get(item.element);
      if (entry?.signature !== signature) {
        if (entry) portraitFrames.remove(entry.group);
        entry = { group: portraitFrames.build(item.width, item.portraitFrame), signature };
        frames.set(item.element, entry); world.root.add(entry.group);
      }
      entry.group.position.set(...item.point);
    }
    for (const [element, entry] of frames) {
      if (!active.has(element)) { portraitFrames.remove(entry.group); frames.delete(element); }
    }
    renderer.shadowMap.needsUpdate = true;
  }
  function positionItems() {
    for (const item of items) {
      if (item.sculptedFrame || item.portraitFrame) {
        let h: number, inset: number;
        if (item.sculptedFrame) {
          const group = sculptedAltar?.frames.get(item.sculptedFrame.id);
          if (!group) continue;
          const { topLeft, topRight, bottomLeft } = item.sculptedFrame.opening;
          photoTopLeft.set(...topLeft).applyMatrix4(group.matrixWorld);
          photoTopRight.set(...topRight).applyMatrix4(group.matrixWorld);
          photoBottomLeft.set(...bottomLeft).applyMatrix4(group.matrixWorld);
          h = photoTopLeft.distanceTo(photoBottomLeft); inset = 0;
          project(photoTopLeft.x, photoTopLeft.y, photoTopLeft.z, origin);
          project(photoTopRight.x, photoTopRight.y, photoTopRight.z, right);
          project(photoBottomLeft.x, photoBottomLeft.y, photoBottomLeft.z, bottom);
        } else {
          const { height, inset: band, faceDepth } = item.portraitFrame!;
          h = height; inset = band;
          const [x, y, z] = item.point;
          project(x - item.width / 2, y + h, z + faceDepth, origin);
          project(x + item.width / 2, y + h, z + faceDepth, right);
          project(x - item.width / 2, y, z + faceDepth, bottom);
        }
        // Orthographic projection is affine, including the sculpted frames' tilted planes.
        const wPx = item.width * 100, hPx = h * 100;
        item.element.style.width = `${wPx}px`; item.element.style.height = `${hPx}px`;
        item.element.style.setProperty("--frame-inset-x", `${inset / item.width * 100}%`);
        item.element.style.setProperty("--frame-inset-y", `${inset / h * 100}%`);
        const matrix = [(right.x - origin.x) / wPx, (right.y - origin.y) / wPx,
          (bottom.x - origin.x) / hPx, (bottom.y - origin.y) / hPx, origin.x, origin.y];
        item.element.style.transform = `matrix(${matrix.map((value, i) => value.toFixed(i < 4 ? 6 : 2)).join(",")})`;
        continue;
      }
      projected.set(...item.point).project(camera);
      const x = (projected.x * .5 + .5) * width, y = (-projected.y * .5 + .5) * height;
      item.element.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) translate(-50%,-100%)`;
      item.element.style.width = `${(item.width * scale).toFixed(2)}px`;
      item.element.style.setProperty("--spatial-scale", String(scale / 100));
    }
  }
  function updateCamera() {
    // Rotate the camera and its offset target together so the altar stays beside the chat.
    pivot.set(0, targetY, 0);
    orbit.setFromEuler(angles.set(easedPitch, easedYaw, 0, "YXZ"));
    camera.position.set(shift + .3, 6.65 - targetY, 15).applyQuaternion(orbit).add(pivot);
    lookTarget.set(shift, 0, 0).applyQuaternion(orbit).add(pivot);
    camera.lookAt(lookTarget); camera.updateMatrixWorld(); positionItems();
  }
  function draw(time = 0) {
    if (disposed || lost) return;
    const t = media.matches ? 0 : time / 1000;
    const targetYaw = THREE.MathUtils.clamp(yaw + (media.matches ? 0 : hoverYaw), -turnLimit, turnLimit);
    const targetPitch = media.matches ? 0 : hoverPitch;
    const easing = media.matches ? 1 : .18;
    easedYaw += (targetYaw - easedYaw) * easing;
    easedPitch += (targetPitch - easedPitch) * easing;
    updateCamera();
    world.flames.forEach((flame, i) => {
      const flicker = Math.sin(t * 3.1 + i * 7) * .05 + Math.sin(t * 7.8 + i) * .03;
      flame.scale.y = .092 * (1 + flicker); flame.rotation.z = flicker * .6;
    });
    world.candleLights.forEach((light, i) => { light.intensity = 5 + Math.sin(t * 3.5 + i * 2) * .3; });
    composer.render();
  }
  function tick(time: number) {
    if (disposed || lost || !visible || document.hidden) return;
    frame = requestAnimationFrame(tick);
    // Candle movement stays gentle; cap at 30fps and stop offscreen.
    if (time - lastTime < 32) return;
    lastTime = time; draw(time);
  }
  function sync() {
    cancelAnimationFrame(frame);
    if (!disposed && visible && !document.hidden && !lost) {
      draw(); if (!media.matches) frame = requestAnimationFrame(tick);
    }
  }
  function resize() {
    width = host.clientWidth; height = host.clientHeight;
    if (!width || !height) return;
    const mobile = width <= 780;
    const guide = host.closest(".ofrenda-home")?.querySelector<HTMLElement>(".ofrenda-conversation");
    const guideWidth = mobile ? 0 : guide?.getBoundingClientRect().width ?? 380;
    available = Math.max(width - guideWidth - (mobile ? 0 : 45), 280);
    const viewHeight = Math.max(7.4, 6.6 * height / available) / VIEW_ZOOM;
    const viewWidth = viewHeight * width / height;
    shift = (width - available) / width * viewWidth / 2;
    // Zoom about the crest so the altar grows down into the floor instead of under the heading.
    targetY = ZOOM_ANCHOR_Y - (ZOOM_ANCHOR_Y - (mobile ? 2.8 : 2.85)) / VIEW_ZOOM;
    camera.left = -viewWidth / 2; camera.right = viewWidth / 2;
    camera.top = viewHeight / 2; camera.bottom = -viewHeight / 2;
    camera.updateProjectionMatrix(); scale = height / viewHeight;
    renderer.setSize(width, height, false); composer.setSize(width, height);
    updateCamera(); renderer.shadowMap.needsUpdate = true; sync();
  }
  function canInteract() { return !disposed && !lost && world.root.visible && host.dataset.sceneStatus === "ready"; }
  function refreshInteraction() {
    // Reduced motion stops the animation loop, so explicit input must request its own render.
    if (media.matches) sync();
  }
  function clearHover() { hoverYaw = hoverPitch = 0; refreshInteraction(); }
  function down(event: PointerEvent) {
    if (!event.isPrimary) { endGesture(); return; }
    if (!canInteract() || event.button !== 0) return;
    const rect = host.getBoundingClientRect();
    if (event.clientX - rect.left > available) return;
    suppressDragClick = false;
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, yaw, dragged: false };
  }
  function move(event: PointerEvent) {
    if (!canInteract()) return;
    if (gesture) {
      if (event.pointerId !== gesture.id) return;
      const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
      if (!gesture.dragged) {
        if (Math.hypot(dx, dy) < 6) return;
        // Let the browser take vertical swipes for page scrolling.
        if (event.pointerType === "touch" && Math.abs(dy) > Math.abs(dx)) { endGesture(); return; }
        gesture.dragged = true;
        host.setPointerCapture(event.pointerId);
        host.dataset.dragging = "true";
        host.focus({ preventScroll: true });
      }
      hoverYaw = hoverPitch = 0;
      yaw = THREE.MathUtils.clamp(gesture.yaw - dx * (4 * turnLimit / available), -turnLimit, turnLimit);
      refreshInteraction();
      return;
    }
    if (!event.isPrimary || event.pointerType === "touch" || event.buttons || media.matches) { clearHover(); return; }
    const rect = host.getBoundingClientRect();
    const x = THREE.MathUtils.clamp((event.clientX - rect.left) / available * 2 - 1, -1, 1);
    const y = THREE.MathUtils.clamp((event.clientY - rect.top) / rect.height * 2 - 1, -1, 1);
    hoverYaw = x * THREE.MathUtils.degToRad(2);
    hoverPitch = y * THREE.MathUtils.degToRad(1);
  }
  function endGesture(event?: PointerEvent) {
    if (!gesture || (event && event.pointerId !== gesture.id)) return;
    const ended = gesture;
    gesture = null;
    delete host.dataset.dragging;
    if (ended.dragged) suppressDragClick = true;
    if (host.hasPointerCapture(ended.id)) host.releasePointerCapture(ended.id);
    clearHover();
  }
  function leave() {
    if (gesture && !gesture.dragged) endGesture();
    clearHover();
  }
  function captureLost(event: PointerEvent) {
    // Touch implicitly captures on the canvas/button first; its loss during transfer bubbles here.
    if (event.target === host) endGesture(event);
  }
  function click(event: MouseEvent) {
    // Keyboard activation has detail=0 and should never be swallowed after a drag.
    if (event.detail > 0 && suppressDragClick) {
      suppressDragClick = false;
      event.preventDefault(); event.stopImmediatePropagation();
    }
  }
  function nativeDrag(event: DragEvent) { if (canInteract()) event.preventDefault(); }
  function resetView() {
    if (!canInteract()) return;
    endGesture(); yaw = 0; clearHover();
  }
  function rotateBy(degrees: number) {
    if (!canInteract()) return;
    endGesture();
    yaw = THREE.MathUtils.clamp(yaw + THREE.MathUtils.degToRad(degrees), -turnLimit, turnLimit);
    clearHover();
  }
  function motionChange() { clearHover(); sync(); }
  function visibilityChange() { if (document.hidden) endGesture(); sync(); }
  function blur() { endGesture(); clearHover(); }
  function contextLost(event: Event) { event.preventDefault(); lost = true; endGesture(); cancelAnimationFrame(frame); onError(); }
  function contextRestored() { lost = false; resize(); onReady(); }
  host.addEventListener("pointerdown", down);
  host.addEventListener("pointermove", move, { passive: true }); host.addEventListener("pointerleave", leave);
  host.addEventListener("pointerup", endGesture); host.addEventListener("pointercancel", endGesture);
  host.addEventListener("lostpointercapture", captureLost);
  host.addEventListener("click", click, true); host.addEventListener("dragstart", nativeDrag);
  window.addEventListener("blur", blur);
  renderer.domElement.addEventListener("webglcontextlost", contextLost); renderer.domElement.addEventListener("webglcontextrestored", contextRestored);
  const observer = new ResizeObserver(resize); observer.observe(host);
  const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }); intersection.observe(host);
  document.addEventListener("visibilitychange", visibilityChange); media.addEventListener("change", motionChange);
  resize(); renderer.shadowMap.autoUpdate = false;
  loadSculptedAltar().then(async (altar) => {
    if (disposed) { altar.dispose(); return; }
    sculptedAltar = altar; world.root.add(altar.root); syncFrames(); world.root.visible = true;
    // Compile every shader in parallel while "Lighting the candles…" shows, instead of stalling the first frame.
    await renderer.compileAsync(scene, camera);
    if (disposed) return;
    renderer.shadowMap.needsUpdate = true; sync(); onReady();
  }).catch((error) => { console.error("The sculpted altar could not load", error); if (!disposed) onError(); });
  return {
    resetView,
    rotateBy,
    setItems(next: SpatialItem[]) {
      items = next; positionItems();
      // React detaches and reattaches callback refs in one commit; reconcile only the final list.
      if (itemsPending || disposed) return;
      itemsPending = true;
      queueMicrotask(() => {
        itemsPending = false;
        if (disposed) return;
        syncFrames(); sync();
      });
    },
    dispose() {
      disposed = true; endGesture(); cancelAnimationFrame(frame); observer.disconnect(); intersection.disconnect();
      host.removeEventListener("pointerdown", down);
      host.removeEventListener("pointermove", move); host.removeEventListener("pointerleave", leave);
      host.removeEventListener("pointerup", endGesture); host.removeEventListener("pointercancel", endGesture);
      host.removeEventListener("lostpointercapture", captureLost);
      host.removeEventListener("click", click, true); host.removeEventListener("dragstart", nativeDrag);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", visibilityChange); media.removeEventListener("change", motionChange);
      renderer.domElement.removeEventListener("webglcontextlost", contextLost); renderer.domElement.removeEventListener("webglcontextrestored", contextRestored);
      frames.forEach(({ group }) => portraitFrames.remove(group)); frames.clear(); portraitFrames.dispose();
      const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
      scene.traverse((node) => {
        if (node instanceof THREE.Mesh) { geometries.add(node.geometry); (Array.isArray(node.material) ? node.material : [node.material]).forEach((m) => materials.add(m)); }
        if (node instanceof THREE.Sprite) materials.add(node.material);
        if (node instanceof THREE.InstancedMesh) node.dispose();
      });
      geometries.forEach((g) => g.dispose()); materials.forEach((m) => m.dispose()); world.textures.forEach((t) => t.dispose());
      key.shadow.dispose(); composer.passes.forEach((pass) => pass.dispose()); composer.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    },
  };
}
export type AltarSceneController = ReturnType<typeof createAltarScene>;
