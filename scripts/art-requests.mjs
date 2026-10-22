import { mkdir, writeFile } from "node:fs/promises";
import { CLASSES, MAPS, MONSTERS, ITEMS, NPCS } from "../site/data.js";
const style =
  "Original production artwork for LeafTale. Match the rich miniature visual density of a finely shaded late-2000s Korean 2D isometric fantasy online RPG: delicate pixel clusters, believable textured materials, organic detailed silhouettes and lush colors. Not basic geometric drawings or flat vector icons. No copied game assets, no text, no labels, no UI.";
const requests = [];
for (const map of MAPS)
  requests.push({
    id: "map-" + map.id,
    target: "site/assets/maps/" + map.id + ".png",
    transparent_background: false,
    prompt: `${style} Full playable map background, landscape1536x1024, elevated orthographic 3/4 game camera, no horizon. Terrain fills the entire image. ${map.name}: ${map.description}. ${map.town ? "Ornate small cottages and market stalls around the periphery, with a large open walkable central square." : "Large organically shaped open walkable floor with environment details around its edges."} Central60% remains traversable. Paths open at the middle of left and right edges. No characters or enemies. Rich decorated foliage, tiny flowers, stones and carefully shaded objects, fully finished art.`,
  });
for (const cls of CLASSES)
  requests.push({
    id: "character-" + cls.id,
    target: "site/assets/characters/" + cls.id + ".png",
    transparent_background: true,
    prompt: `${style} Exact square1024x1024 transparent animation atlas, 8columns x8rows,64 equal128x128 cells, no borders or labels. ONE consistent original cute three-head-tall ${cls.name} wielding ${cls.weapon}; ${cls.description}. Feet pivot(64,110), same scale and anatomy every cell. Four direction groups16frames each, each occupies2rows: south,east,north,west. Within each group:2breathing idle,6alternating-foot walk,6attack anticipation/strike/recovery,1hurt,1fallen. Fine shaded character detail, cloth/hair follow-through, consistent volume, no environment.`,
  });
for (let group = 0; group < 10; group++) {
  const monsters = MONSTERS.slice(group * 4, group * 4 + 4);
  requests.push({
    id: "monsters-" + group,
    target: "site/assets/creatures/group-" + group + ".png",
    transparent_background: true,
    prompt: `${style} Square1024x1024 transparent game animation atlas, EXACT8columns x8rows,64 equal128x128 cells. Four distinct creatures, each occupies TWO consecutive rows=16frames: ${monsters.map((m, i) => `Creature${i + 1}: ${m.name}, ${m.shape}, ${m.lore}`).join("; ")}. Every group:2idle breathing frames,6natural locomotion frames,6attack anticipation/impact/recovery frames,1recoil,1fallen. Southeast three-quarter view, feet pivot(64,108). Same identity and scale across each creature's frames. Each species must have unique anatomy and accessories, not just a recolor. No labels, no drawn grid, true alpha background.`,
  });
}
requests.push({
  id: "npcs",
  target: "site/assets/npcs.png",
  transparent_background: true,
  prompt: `${style} Exact8column x4row transparent atlas,32 equal cells. Eight distinct detailed original forest/coastal villagers,4consecutive frames each (2breathing,2talking). Each has consistent proportions and feet pivot. Characters: ${NPCS.map((n) => n.name + " / " + n.role).join("; ")}. Richly shaded clothes and accessories, friendly faces, 3/4 isometric view.`,
});
requests.push({
  id: "icons",
  target: "site/assets/items.png",
  transparent_background: true,
  prompt: `${style} Exact8column x8row transparent inventory/ability atlas,64 equal128px cells on1024px square. Detailed dimensional miniature pixel-painted icons, no border or labels. First42 icons row-major exactly: ${Object.values(
    ITEMS,
  )
    .map((i, n) => n + ":" + i.name)
    .join(
      "; ",
    )}. Following16 icons are the four class's skill emblems (spear/shield/thorn/antler; leaf magic/moon burst/vine/lunar beam; arrow/dodge/target/hawk; healing/blight/garden/flower). Last6: basic attack, healing vial, chat scroll, parchment map, glowing travel rune, gold coin.`,
});
requests.push({
  id: "effects",
  target: "site/assets/effects.png",
  transparent_background: true,
  prompt: `${style} Transparent1024x1024 visual effects sprite atlas, exact8columns x8rows,64 cells. Each row is ONE8-frame coherent animation. Row1leaf sword sweep;row2lunar magic burst;row3healing blossoms;row4silver arrow trail;row5purple poison plume;row6gold-green protective shield;row7gold pollen sparks;row8soft teal travel rune. Smooth anticipation/expansion/dissipation. No character, no text, crisp elegant detailed effects.`,
});
requests.push({
  id: "interface",
  target: "site/assets/interface.png",
  transparent_background: true,
  prompt: `${style} Beautiful original forest RPG user-interface ornamental frame asset, square1024px transparent background. An empty dark moss-green parchment panel with very detailed carved wooden corners and tiny gold leaf inlays, wide quiet center, all decorations at the edges so it supports nine-slice scaling. No text, no icons, no buttons, no characters.`,
});
await mkdir("art", { recursive: true });
await writeFile(
  "art/image-requests.json",
  JSON.stringify(
    {
      status: "blocked-by-image-tool",
      error: "HTTP400 Unknown parameter: reasoning",
      requirements:
        "All replacement artwork must be generated through image generation. No procedural/raster-drawing fallback.",
      requests,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Saved ${requests.length} image-tool requests; no images generated. Use the image generation tool for these requests.`,
);
