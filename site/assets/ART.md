# Fine pixel artwork · LeafTale v0.6.0

All 67 active source artworks were regenerated using extracted frames of the user's monster animation as the style reference. The new art uses delicate local-color contours and softly shaded pastel pixels. Packing preserves those contours: it never paints a dark border or forces dark areas into navy. A shared adaptive palette of up to 256 colors replaces the former 32-color limit.

In the game world one native pixel maps to two screen pixels for terrain, actors, items and effects. Native cells remain 32/48/64px for monsters, 48px for players/NPCs, 16px for items and 32/48/64px for effects. Maps are 960×640, title 480×320 and frame 128×128. Fractional item/effect scaling is removed. Bestiary item icons use the same 2x display.

The 525 PNGs include 52 eight-direction animated atlases, 416 individual directional views and forty front portraits. Headings: N, NE, E, SE, S, SW, W, NW. Each has walking four frames, attack two, hurt and defeat. Only 69 runtime atlases/backgrounds load at startup. The 2D turnaround artwork is informed by 3D volume; no mesh files are claimed.

See `manifest.json` for layouts, `../../art/refinement-sources.json` for current prompts/source paths, `../../art/shared-palette.json` for the palette, `../../art/generated-assets.json` for checksums and `../../art/style-audit.json` for contour measurements. Normal builds use committed PNGs and need no generation tools or ImageMagick.
