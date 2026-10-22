# Original project artwork

- `title-forest.png`: original fantasy forest title background generated for LeafTale during development. Included directly; it is not an asset from an existing game.
- `m1.png` through `m40.png`: original species-specific pixel atlases drawn by `scripts/generate-art.py` using geometric pixel primitives, fixed pivots and an articulated pose sequence. There are unique carried objects/body features in addition to palettes.
- `warden.png`, `mage.png`, `ranger.png`, `herbalist.png`: original character atlases.
- Environment sprites: original tree, palm, house, bush, rock and crystal pixel drawings.
- `items.png`: 42 original item icons, indexed by `manifest.json`.

Atlas layout: 64×64 frame, 24 columns, four direction rows (south, east, north, west). Columns: idle 0–3, walk 4–9, attack 10–15, hurt 16–17, death 18–23. Walk includes alternating feet/limbs and body bounce. Attack includes anticipation, strike and recovery. Species accessories follow the same body pivot.

Regenerate pixel assets with Python 3 + Pillow: `npm run art`. It reads the project's content data. The generated files are checked in; running the game/build does not require Python, Pillow, image-generation access or third-party art services.
