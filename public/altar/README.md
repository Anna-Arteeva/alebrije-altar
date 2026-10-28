# Layered ofrenda assets

Generated with the built-in image generation tool on October 27, 2026. Both PNG files retain their transparent alpha channels. The altar reference was used for the overall composition, linen tiers and abundant marigolds; the existing offering paintings remain independent interactive layers.

## Prompts

### linen-tier.png

Create a photorealistic natural cutout asset for a layered interactive Mexican ofrenda altar website. A single wide low rectangular altar platform draped in warm ivory linen with realistic folds hanging down the front, subtly embroidered edge. Straight-on camera slightly above table so top is visible. Width to height roughly 3:1. Empty flat tabletop, no offerings, no flowers, no candles, no frames, no background or floor. Warm late-afternoon light from upper left. Entire object fully visible with margin. Actual transparent background. This platform will repeat at different widths to form altar tiers. No text.

### marigold-arrangement.png

Use case photorealistic-natural. A reusable transparent PNG cutout for a Mexican ofrenda website: tall abundant asymmetrical arrangement of orange and golden cempasuchil marigolds, a few dark green fern leaves and long palm fronds, in an aged terracotta pot, branches reaching upward and outward. Inspired by a real lush home altar. Front view, warm afternoon lighting from upper left, real botanical textures, graceful natural silhouette. Entire arrangement visible, transparent background, no floor, no wall, no text, no candles, no altar furniture. Vertical composition.

## Layout and growth

`AltarScene` renders flowers behind repeatable linen tiers, then interactive portraits and offerings above the cloth. Each two people create another portrait tier. Each five personal objects create another offering tier. Memory tags wrap on the lowest tier. Portraits keep the original uploaded image.

The existing `loved_ones` table already supports multiple people per altar. `AltarState.people` holds previous people, while `lovedOne` identifies the active interview. A persisted note marks each new person's conversation boundary, so reloads restore that person and the AI receives only their conversation, memories and objects. Existing single-person records remain compatible. No database migration is required.

## Independent 3D portrait frames

`npm run art:altar` converts the source STL into `ofrenda-altar.glb` with four named meshes: `altar-body`, `portrait-centre`, `portrait-left`, and `portrait-right`. Frame bounds, pivots, and photo openings are measured in model millimetres in `src/lib/altar3d/sculpted-frames.ts`.

The conversion preserves vertex paint and normals and caps the cuts on both sides. The source frame bottoms are fused into the flower bank. Their hidden contact areas are repaired by mirroring each frame's clean upper carving across the centre of its tilted photo opening. This gives the movable frames complete mouldings without attached flower fragments.

The empty altar shows one central invitation. A single person's frame is twice its normal size, with its foot kept at the top shelf's height. It expands upward in front of the upper decorations. Two or three people use the original central and side placements; unused frames are hidden. Later people keep their separate decorative frames. Photos use their frame's world transform, so they stay aligned as the composition changes or the view turns.

Run `npm run check:altar` to check capped extraction, repaired frame volumes, vertex paint and normals, named asset parts, and layout transitions in both directions.
