import type { ElementKey } from "@/lib/types";
import { SCULPTED_FRAME_SPECS, type SculptedFrameId } from "./sculpted-frames.ts";

export type Anchor = readonly [number, number, number];

/** The sculpted altar is authored in millimetres; this maps it into scene units. */
export const ALTAR_SCALE = .0225;
export const ALTAR_Z = -.9;
/** Meshopt-compressed by scripts/convert-altar-stl.mts; the page preloads it alongside the scene code. */
export const SCULPTED_ALTAR_URL = "/altar/ofrenda-altar.glb";
export const onAltar =(x: number, y: number, z: number): Anchor => [x * ALTAR_SCALE, y * ALTAR_SCALE, z * ALTAR_SCALE + ALTAR_Z];

export const OFFERING_ANCHORS: Partial<Record<ElementKey, Anchor>> = {
  candles: onAltar(-25.5, 148, -11), water: onAltar(66, 132, -10), pan_de_muerto: onAltar(0, 99, 20),
  salt: onAltar(16, 82, 30), calaveritas: onAltar(-39, 70, 40),
  cempasuchil: onAltar(-90, 104, 30), copal: onAltar(54, 101, 18), papel_picado: onAltar(0, 196, -28),
};

/** Sculpted candle flame tips, so the scene can light them. */
export const SCULPTED_FLAMES: Anchor[] = [onAltar(-25.5, 141, -11), onAltar(23, 141, -11), onAltar(-27.5, 100, 18), onAltar(27.5, 100, 18)];

export type PortraitFrame = { height: number; inset: number; faceDepth: number };
/** Photo corners relative to the extracted frame's pivot, in model millimetres. */
export type PortraitOpening = { topLeft: Anchor; topRight: Anchor; bottomLeft: Anchor };
export type SculptedPortrait = { id: SculptedFrameId; scale: number; opening: PortraitOpening };
export type PortraitSlot = { point: Anchor; width: number } & (
  | { sculptedFrame: SculptedPortrait; portraitFrame?: never }
  | { portraitFrame: PortraitFrame; sculptedFrame?: never }
);

/** Each photo uses the same local pivot and transform as its extracted carving. */
export function portraitSlot(index: number, peopleCount: number): PortraitSlot {
  if (index < SCULPTED_FRAME_SPECS.length) {
    const spec = SCULPTED_FRAME_SPECS[index];
    const scale = peopleCount === 1 ? 2 : 1;
    const local = (point: Anchor): Anchor => [point[0] - spec.pivot[0], point[1] - spec.pivot[1], point[2] - spec.pivot[2]];
    return {
      // Keep the foot at the top shelf's height; the larger carving grows upward.
      point: peopleCount === 1 ? onAltar(spec.pivot[0], spec.pivot[1], 45) : onAltar(...spec.pivot),
      width: (spec.opening.topRight[0] - spec.opening.topLeft[0]) * ALTAR_SCALE * scale,
      sculptedFrame: { id: spec.id, scale, opening: {
        topLeft: local(spec.opening.topLeft), topRight: local(spec.opening.topRight), bottomLeft: local(spec.opening.bottomLeft),
      } },
    };
  }
  const secondary = { width: .57, portraitFrame: { height: .9, inset: .0741, faceDepth: .112 } };
  const side = index % 2 ? -1 : 1, step = Math.floor((index - 3) / 2);
  return { point: onAltar(side * (70 + step * 30), 112, 10), ...secondary };
}
/** Keepsakes line the two carved front steps, then gather on the floor in front of the altar. */
export function objectAnchor(index: number): Anchor {
  const row = Math.floor(index / 5), column = index % 5 - 2;
  if (row === 0) return onAltar(column * 30, 42, 52);
  if (row === 1) return onAltar(column * 34, 26, 74);
  return onAltar(column * 36, 0, 98 + (row - 2) * 30);
}
