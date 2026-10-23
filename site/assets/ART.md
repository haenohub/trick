# Native pixel artwork

The original art was regenerated with `image_gen` for LeafTale v0.4.0. Thirty source sheets/paintings are normalized into 102 native PNG assets using a shared 32-color palette and binary transparency. No geometric drawing fallback is used.

Monster frames and individual portraits are exactly 32×32, 48×48 or 64×64. Player/NPC frames are 48×48; item and trophy icons 16×16; effect frames 32×32 / 48×48 / 64×64; maps 960×640. The game presents the world on a 2× pixel grid with nearest-neighbor sampling.

See `manifest.json` for runtime layouts, `../../art/pixel-sources.json` for generation prompts and original paths, `../../art/generated-assets.json` for asset provenance/checksums, and `../../ART_REWORK.md` for the packing workflow. Source images are retained in the generation workspace; committed native PNGs support normal builds without generation tools.
