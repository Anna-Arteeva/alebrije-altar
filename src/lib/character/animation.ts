import type { CharacterRig } from "./model";

/** Absolute poses avoid drift after pausing or returning to a background tab. */
export function animateCharacter(rig: CharacterRig, seconds: number) {
  const breath = Math.sin(seconds * 1.45);
  rig.torso.scale.y = 1 + breath * 0.003;
  rig.head.rotation.z = Math.sin(seconds * 0.48) * 0.025;
  rig.head.rotation.y = Math.sin(seconds * 0.34) * 0.045;
  rig.wings.forEach((wing, i) => {
    wing.rotation.z = (i ? -0.23 : 0) + Math.sin(seconds * 0.9 + 0.4) * 0.012 * (i ? -1 : 1);
  });
  rig.tail.rotation.z = Math.sin(seconds * 0.68) * 0.025;
  const phase = seconds % 5.7;
  const blink = phase > 5.38 ? Math.sin((phase - 5.38) / 0.32 * Math.PI) : 0;
  rig.eyelids.forEach((lid) => {
    lid.visible = blink > 0.01;
    lid.scale.y = Math.max(0.001, blink);
  });
}
