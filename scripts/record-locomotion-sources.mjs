import { readFile, writeFile, readdir } from "node:fs/promises";
const file = "art/locomotion-sources.json";
const plan = JSON.parse(await readFile(file, "utf8"));
for (const name of await readdir("/tmp")) {
  if (!/^leaftale-locomotion-[a-z0-9-]+\.json$/i.test(name)) continue;
  const receipt = JSON.parse(await readFile("/tmp/" + name, "utf8"));
  const entry = [...plan.sources, ...plan.pending].find(
    (a) => a.id === receipt.id,
  );
  if (!entry) continue;
  plan.sources = plan.sources.filter((a) => a.id !== receipt.id);
  plan.sources.push({ ...entry, source: receipt.path });
  plan.pending = plan.pending.filter((a) => a.id !== receipt.id);
}
plan.updatedAt = new Date().toISOString();
if (!plan.pending.length) {
  plan.completedAt = plan.updatedAt;
  plan.status = "generated";
  delete plan.blocker;
} else if (plan.blocker) {
  plan.blocker.remainingSources = plan.pending.length;
}
await writeFile(file, JSON.stringify(plan, null, 2) + "\n");
console.log(
  plan.sources.length +
    "/144 direction sheets; " +
    plan.pending.length +
    " pending",
);
