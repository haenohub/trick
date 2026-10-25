import { readFile, writeFile, readdir } from "node:fs/promises";
const file = "art/motion-sources.json";
const plan = JSON.parse(await readFile(file, "utf8"));
for (const name of await readdir("/tmp")) {
  if (!/^leaftale-motion-[a-z0-9-]+\.json$/.test(name)) continue;
  const { id, path } = JSON.parse(await readFile("/tmp/" + name, "utf8"));
  const entry =
    plan.sources.find((a) => a.id === id) ||
    plan.pending.find((a) => a.id === id);
  if (!entry) continue;
  plan.sources = plan.sources.filter((a) => a.id !== id);
  plan.sources.push({ ...entry, source: path });
  plan.pending = plan.pending.filter((a) => a.id !== id);
}
plan.updatedAt = new Date().toISOString();
if (!plan.pending.length) plan.completedAt = plan.updatedAt;
await writeFile(file, JSON.stringify(plan, null, 2) + "\n");
console.log(
  plan.sources.length +
    "/73 generated sources ready; " +
    plan.pending.length +
    " pending",
);
