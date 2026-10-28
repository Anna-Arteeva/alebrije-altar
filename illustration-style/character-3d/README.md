# Alebrije character study

Open `/character` in the Next.js app. This is a procedural Three.js reconstruction of the supplied alpaca-bird illustration. It is a stylized interpretation, not a recovered mesh. The conversation experience is a separate phase.

## Artwork

- `original.png`: the user's definitive character reference.
- `turnaround.png`: front, left, right, and rear views made with the built-in imagegen tool. These establish the unseen anatomy and markings. The original takes precedence where generated views disagree.
- `body-paint.png` and `feather-paint.png`: flat painted texture sources made with the same tool.
- `generation.json`: exact prompts, source roles, tool choice, and runtime asset paths.
- `../../public/character/`: WebP runtime copies, encoded at quality 92. The original PNGs are retained here.

The public `reference.png` alias is also retained because another existing app component uses it.

The mesh preserves two legs, an alpaca head and long neck, a rounded body, two raised wings, a feather crest, and a short feather tail. Wings sweep backward at different angles to retain volume from the side and preserve both wings in the default portrait. Wool tufts are separate curved surfaces. The main body and neck use continuous UVs; individual feathers sample larger sections of the feather painting.

## Reuse

`src/lib/character/model.ts` builds a model independently of the renderer. `animation.ts` poses its head, torso, wings, tail, and eyelids without accumulating transform drift. The feet stay fixed. `scene.ts` owns lighting, camera, controls, loading, animation scheduling, and GPU disposal.

Load `CharacterCanvas` dynamically from a client component with `ssr: false`. Its props are `className`, `style`, `animated`, `interactive`, `view`, `viewRevision`, `zoomCommand`, and `onStatusChange`. Give it a sized parent, or use `style={{ position: "relative", height: 520 }}`. The view names are `portrait`, `front`, `left`, `right`, and `back`; increment `viewRevision` to reset an already-selected view. Status is `loading`, `ready`, or `error`.

Reduced motion disables idle animation. Pausing returns to a neutral pose so a character is never frozen halfway through a blink. Rendering stops while the tab or canvas is hidden, and idle animation is capped at 60 fps. Unsupported WebGL, a lost context, or a failed texture load shows the original illustration. Unmounting disconnects observers/listeners, cancels animation, and releases geometry, materials, textures, shadows, and the WebGL context.

The preview stylesheet uses `character-` class names. This avoids the project's custom Tailwind loader treating CSS modules as global styles and dropping module exports.

## Validation

Run `npm run check:character`, `npm run lint`, and `npm run build`.

The character check validates finite positions/normals/UVs, outward feather normals, bounds, a triangle/draw budget, planted feet, blink limits, transform stability over two minutes of simulated idle, and runtime asset presence. The final model contains 44 batched meshes and 155,996 triangles. Shadow rendering adds a second pass.

Browser checks cover desktop and a 390 × 844 mobile viewport, preset angles, zoom, keyboard activation, pause/reset, the reference toggle, and a deliberately missing texture. The missing-texture case showed the original illustration; the asset was then restored. The mobile viewport had no horizontal overflow. A desktop-browser sample with the mobile viewport exceeded 30 fps; this is not a physical-phone benchmark. Reduced-motion preference wiring and context-loss cleanup were reviewed in code, rather than emulated through OS settings.

Rendered comparison views are saved under `validation/`. No external image-to-3D service or runtime generation API is needed.
