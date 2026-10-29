import { setTimeout as delay } from "node:timers/promises";

const { PAGE_URL, GITHUB_SHA } = process.env;
if (!PAGE_URL || !/^[0-9a-f]{40}$/.test(GITHUB_SHA || "")) {
  throw new Error("PAGE_URL and the full GITHUB_SHA are required");
}
const base = new URL(PAGE_URL.endsWith("/") ? PAGE_URL : PAGE_URL + "/");
if (base.protocol !== "https:")
  throw new Error("Deployment verification requires HTTPS");

let lastError;
for (let attempt = 1; attempt <= 12; attempt++) {
  try {
    const url = new URL("deployment.json", base);
    url.searchParams.set("revision", GITHUB_SHA);
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    if (!response.ok)
      throw new Error(`Deployment metadata: HTTP ${response.status}`);
    const manifest = await response.json();
    if (manifest.kind !== "leaftale" || manifest.commit !== GITHUB_SHA) {
      throw new Error("The published commit does not match this workflow run");
    }
    for (const file of [
      "",
      "styles.css",
      "bestiary.html",
      "directions.html",
      "maps.html",
      "map-atlas.js",
      "isometric-layouts.js",
      "assets/world/iso-village-floor.png",
      "assets/world/iso-village-props.png",
      "assets/world/iso-seacave-floor.png",
      "assets/world/iso-seacave-props.png",
      "directions.js",
      "app.js",
      "data.js",
      "core.js",
      "balance.js",
      "combat.js",
      "targeting.js",
      "assets/targeted-combat.png",
      "exploration.js",
      "audio.js",
      "controls.js",
      "animation.js",
      "avatar-draw.js",
      "progression.js",
      "living-world.js",
      "assets/ambient.png",
      "view-projection.js",
      "pickup-hold.js",
      "equipment-appearance.js",
      "equipment-tiers.js",
      "assets/class-skills-v23.png",
      "assets/tier-weapon-icons.png",
      "assets/appearance/tier-bow.png",
      "ecology.js",
      "assets/currency-leaf.png",
      "renderer.js",
      "assets/manifest.json",
      "art-layout.js",
      "world-layout.js",
      "verdant.js",
      "assets/creatures/m60.png",
      "assets/directions/m60/SW.png",
      "assets/verdant-trophies.png",
      "assets/world/tiles-village.png",
      "assets/world/tiles-seacave.png",
      "assets/world/props.png",
      "assets/creatures/m40.png",
      "assets/npcs/guide.png",
      "assets/locomotion/warden-walk.png",
      "assets/locomotion/warden-idle.png",
      "assets/locomotion/guide-idle.png",
      "assets/locomotion/m1-walk.png",
      "assets/locomotion/m16-idle.png",
      "assets/locomotion/m60-walk.png",
      "assets/locomotion/m60-idle.png",
      "assets/appearance/base/warden.png",
      "assets/appearance/held-weapons.png",
      "assets/appearance/hands/herbalist.png",
      "assets/combat/herbalist.png",
      "assets/combat/m60.png",
      "assets/appearance/gear/warden-spear2.png",
      "assets/appearance/gear/mage-staff1.png",
      "assets/appearance/gear/ranger-hawkweapon.png",
      "assets/appearance/gear/herbalist-venomweapon.png",
      "assets/directions/warden/N.png",
      "assets/maps/seacave.png",
    ]) {
      const asset = await fetch(new URL(file, base), {
        signal: AbortSignal.timeout(10000),
      });
      if (!asset.ok)
        throw new Error(`${file || "index.html"}: HTTP ${asset.status}`);
      if (file.endsWith(".png")) {
        if (!(asset.headers.get("content-type") || "").includes("image/png"))
          throw new Error("Invalid sprite content type");
        continue;
      }
      const content = await asset.text();
      if (file === "" && !content.includes("리프테일"))
        throw new Error("Unexpected page content");
      if (file === "styles.css" && !content.includes("--panel"))
        throw new Error("Unexpected stylesheet");
      if (file === "app.js" && !content.includes("loadArt"))
        throw new Error("Unexpected script");
      if (file === "bestiary.html" && !content.includes('id="bestiary-data"'))
        throw new Error("Missing bestiary data");
      if (
        file === "directions.html" &&
        !content.includes('id="direction-data"')
      )
        throw new Error("Missing eight-direction atelier data");
    }
    console.log(`Verified public deployment of ${GITHUB_SHA} at ${base}`);
    process.exit(0);
  } catch (error) {
    lastError = error;
    console.log(`Verification attempt ${attempt}/12: ${error.message}`);
    if (attempt < 12) await delay(5000);
  }
}
throw lastError;
