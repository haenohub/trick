import { cp, mkdir, rm, writeFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const output = new URL("../dist/", import.meta.url);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(new URL("../site/", import.meta.url), output, { recursive: true });
// Version the entry points and their imports so an older cached test page cannot
// mix its scripts with a newly deployed game.
const revision = process.env.GITHUB_SHA || Date.now().toString(36);
const htmlFile = new URL("index.html", output);
let html = await readFile(htmlFile, "utf8");
html = html
  .replace(
    "<head>",
    `<head>\n<meta name="leaftale-revision" content="${revision}">`,
  )
  .replace("./styles.css", `./styles.css?v=${revision}`)
  .replace("./app.js", `./app.js?v=${revision}`);
await writeFile(htmlFile, html);
for (const name of [
  "app.js",
  "renderer.js",
  "core.js",
  "data.js",
  "art-layout.js",
]) {
  const file = new URL(name, output);
  let text = await readFile(file, "utf8");
  text = text.replace(
    /(from\s+)(["'])(\.\/[^"'?]+\.js)\2/g,
    (_, prefix, quote, path) =>
      `${prefix}${quote}${path}?v=${revision}${quote}`,
  );
  text = text.replace(
    "./assets/manifest.json",
    `./assets/manifest.json?v=${revision}`,
  );
  await writeFile(file, text);
}
const cssFile = new URL("styles.css", output);
await writeFile(
  cssFile,
  (await readFile(cssFile, "utf8")).replace(
    /(\.\/assets\/[a-z0-9/-]+\.png)/gi,
    `$1?v=${revision}`,
  ),
);
const manifest = {
  kind: "leaftale",
  version: "0.3.0",
  commit: process.env.GITHUB_SHA || "local",
  builtAt: new Date().toISOString(),
};
await writeFile(
  new URL("deployment.json", output),
  JSON.stringify(manifest, null, 2) + "\n",
);
await writeFile(new URL(".nojekyll", output), "");
console.log(`Built LeafTale: ${fileURLToPath(output)}`);
