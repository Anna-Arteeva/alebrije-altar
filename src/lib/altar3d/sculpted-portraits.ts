import type { Group } from "three";
import { ALTAR_SCALE, type Anchor, type SculptedPortrait } from "./layout.ts";
import type { SculptedFrameId } from "./sculpted-frames.ts";

/** Reconcile the same three frame objects as people are added or removed. */
export function placeSculptedFrames(
  frames: ReadonlyMap<SculptedFrameId, Group>,
  items: readonly { point: Anchor; sculptedFrame?: SculptedPortrait }[],
) {
  frames.forEach(group => { group.visible = false; });
  for (const item of items) {
    if (!item.sculptedFrame) continue;
    const group = frames.get(item.sculptedFrame.id);
    if (!group) continue;
    group.visible = true; group.position.set(...item.point);
    group.scale.setScalar(ALTAR_SCALE * item.sculptedFrame.scale); group.updateMatrixWorld(true);
  }
}
