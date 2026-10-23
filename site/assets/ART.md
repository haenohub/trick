# Native pixel artwork

LeafTale v0.5.0 uses 52 newly image-generated, 3D-informed eight-direction actor sheets: four player classes, eight NPCs and forty monsters. Each actor has 8×8 native cells: eight headings (N, NE, E, SE, S, SW, W, NW) and eight animation poses. These are pixel-art turnarounds based on consistent volumes and occlusion; no mesh files are claimed. All directions originate from generated artwork, without runtime mirroring or synthetic rotations.

Monster cells and portraits are exactly 32×32, 48×48 or 64×64. Player/NPC cells are 48×48; item and trophy icons 16×16; effect cells 32×32 / 48×48 / 64×64; maps 960×640. Artwork uses a shared 32-color palette, binary alpha and integer-scaled nearest-neighbor display.

The 525 committed PNGs include 416 individual directional views. Only 69 runtime atlases/backgrounds load at game startup. `../directions.html` previews all 52 actors, eight directions and animations, with individual PNG downloads.

See `manifest.json` for layouts, `../../art/directional-sources.json` and `../../art/pixel-sources.json` for generation prompts and source paths, `../../art/generated-assets.json` for provenance/checksums, and `../../ART_REWORK.md` for the packing workflow. Originals are retained in the generation workspace. Normal builds require neither generation tools nor ImageMagick.
