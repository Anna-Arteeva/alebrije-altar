/** Model millimetres: X right, Y up, Z towards the viewer. */
type Point = readonly [number, number, number];
export type SculptedFrameId = "portrait-centre" | "portrait-left" | "portrait-right";

export const SCULPTED_FRAME_SPECS: readonly {
  id: SculptedFrameId;
  pivot: Point;
  slope: number;
  bounds: { x: readonly [number, number]; y: readonly [number, number]; depth: readonly [number, number] };
  opening: { topLeft: Point; topRight: Point; bottomLeft: Point };
}[] = [
  {
    id: "portrait-centre", pivot: [-.5, 118.5, -10.14], slope: .305,
    bounds: { x: [-20, 19], y: [118.5, 160.5], depth: [20.5, 31] },
    opening: { topLeft: [-12.75, 152.75, -20.25], topRight: [10.75, 152.75, -20.25], bottomLeft: [-12.75, 124.5, -11.65] },
  },
  {
    id: "portrait-left", pivot: [-37.25, 121, -18.93], slope: .23,
    bounds: { x: [-47, -26.5], y: [121, 144.5], depth: [4.5, 12.5] },
    opening: { topLeft: [-42.75, 140, -23.25], topRight: [-31.5, 140, -23.25], bottomLeft: [-42.75, 125.25, -19.85] },
  },
  {
    id: "portrait-right", pivot: [34.75, 121, -19.63], slope: .23,
    bounds: { x: [25, 45], y: [121, 144.5], depth: [3.8, 11.8] },
    opening: { topLeft: [29, 140, -23.9], topRight: [39.75, 140, -23.9], bottomLeft: [29, 125.25, -20.55] },
  },
];
