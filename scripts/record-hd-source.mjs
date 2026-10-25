import { readFileSync, writeFileSync, existsSync } from "node:fs";
const [id, source] = process.argv.slice(2);
if (
  !/^[a-z0-9-]+$/.test(id) ||
  !source?.startsWith("/workspace/generated_images/") ||
  !existsSync(source)
)
  throw Error("Invalid generated source");
const file = "art/hd-sources.json",
  registry = JSON.parse(readFileSync(file));
const entry =
  registry.pending.find((a) => a.id === id) ||
  registry.sources.find((a) => a.id === id);
if (!entry) throw Error("Unknown source " + id);
registry.sources = registry.sources.filter((a) => a.id !== id);
registry.sources.push({ ...entry, source });
registry.pending = registry.pending.filter((a) => a.id !== id);
registry.updatedAt = new Date().toISOString();
writeFileSync(file, JSON.stringify(registry, null, 2) + "\n");
console.log(
  id,
  "saved;",
  registry.sources.length + "/90 ready;",
  registry.pending.length + " pending",
);
