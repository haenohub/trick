import { CHESTS } from "../site/exploration.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { WebSocket } from "ws";
import { NAVIGATION } from "../site/world-layout.js";
import { startServer } from "../server/index.mjs";
async function client(port, token) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`),
    messages = [];
  ws.on("message", (d) => messages.push(JSON.parse(d)));
  await once(ws, "open");
  ws.send(
    JSON.stringify({
      type: "join",
      classId: "warden",
      name: "함께 걷기",
      token,
    }),
  );
  const wait = async (predicate) => {
    for (let i = 0; i < 100; i++) {
      const found = messages.find(predicate);
      if (found) return found;
      await delay(20);
    }
    throw Error("Timed out waiting for server message");
  };
  const welcome = await wait((m) => m.type === "welcome");
  await wait((m) => m.type === "state");
  return { ws, messages, wait, token: welcome.token };
}
test("live server restores uncollected treasure to a new connection without leaving duplicate owners", async () => {
  const dir = await mkdtemp(join(tmpdir(), "leaftale-treasure-"));
  let app;
  const sockets = [];
  try {
    app = await startServer({ port: 0, host: "127.0.0.1", dataDir: dir });
    const a = await client(app.port);
    sockets.push(a.ws);
    const state = await a.wait((m) => m.type === "state"),
      id = state.state.player.id,
      p = app.world.players.get(id),
      chest = CHESTS.find((c) => c.map === "sprout");
    Object.assign(p, { map: "sprout", x: chest.x, y: chest.y });
    await a.wait(
      (m) =>
        m.type === "state" && m.state.chests.some((c) => c.id === chest.id),
    );
    a.ws.send(
      JSON.stringify({
        type: "action",
        action: { type: "openChest", chest: chest.id },
      }),
    );
    await a.wait(
      (m) =>
        m.type === "state" &&
        m.state.player.exploration.opened.includes(chest.id),
    );
    a.ws.close();
    await once(a.ws, "close");
    for (let i = 0; i < 50 && app.world.players.has(id); i++) await delay(20);
    assert.ok(!app.world.players.has(id));
    assert.ok(!app.world.map("sprout").drops.some((d) => d.owner === id));
    const resumed = await client(app.port, a.token);
    sockets.push(resumed.ws);
    const restored = (await resumed.wait((m) => m.type === "state")).state;
    assert.notEqual(restored.player.id, id);
    assert.equal(
      restored.drops.filter((d) => d.treasure === chest.id).length,
      4,
    );
    const money = restored.drops.find((d) => d.kind === "currency");
    resumed.ws.send(
      JSON.stringify({
        type: "action",
        action: { type: "pickup", drop: money.id },
      }),
    );
    const awarded = (
      await resumed.wait(
        (m) =>
          m.type === "state" &&
          m.state.player.gold === restored.player.gold + money.count,
      )
    ).state;
    assert.equal(awarded.player.exploration.pending[0].rewards.length, 3);
    assert.equal(awarded.player.lootNotices.at(-1).kind, "currency");
  } finally {
    for (const ws of sockets) ws.terminate();
    if (app) await app.close();
    await rm(dir, { recursive: true, force: true });
  }
});
test("two real WebSocket clients share a map, chat, reject invented rewards and resume server saves", async () => {
  const dir = await mkdtemp(join(tmpdir(), "leaftale-server-"));
  let app;
  const sockets = [];
  try {
    app = await startServer({ port: 0, host: "127.0.0.1", dataDir: dir });
    assert.equal(
      (await fetch(`http://127.0.0.1:${app.port}/health`)).status,
      200,
    );
    const a = await client(app.port),
      b = await client(app.port);
    sockets.push(a.ws, b.ws);
    await a.wait((m) => m.type === "state" && m.state.peers.length === 1);
    await b.wait((m) => m.type === "state" && m.state.peers.length === 1);
    a.ws.send(JSON.stringify({ type: "chat", text: "숲에서 만나요" }));
    await b.wait((m) => m.type === "chat" && m.text === "숲에서 만나요");
    a.messages.length = 0;
    a.ws.send(
      JSON.stringify({
        type: "action",
        action: { type: "grantGold", amount: 99999 },
      }),
    );
    a.ws.send(
      JSON.stringify({
        type: "action",
        action: { type: "buy", item: "salve" },
      }),
    );
    const bought = await a.wait(
      (m) => m.type === "state" && m.state.player.inventory.salve === 6,
    );
    assert.equal(bought.state.player.gold, 60);
    a.ws.send(
      JSON.stringify({
        type: "action",
        action: { type: "moveTo", x: 1e9, y: 1e9 },
      }),
    );
    await delay(150);
    const latest = a.messages.filter((m) => m.type === "state").at(-1);
    assert.equal(latest.state.player.x, NAVIGATION.village.spawn.x);
    await app.close();
    app = null;
    app = await startServer({ port: 0, host: "127.0.0.1", dataDir: dir });
    const resumed = await client(app.port, a.token);
    sockets.push(resumed.ws);
    const saved = await resumed.wait((m) => m.type === "state");
    assert.equal(saved.state.player.inventory.salve, 6);
    assert.equal(saved.state.player.gold, 60);
    assert.equal(
      (await fetch(`http://127.0.0.1:${app.port}/server/data/sessions.json`))
        .status,
      404,
    );
  } finally {
    for (const ws of sockets) ws.terminate();
    if (app) await app.close();
    await rm(dir, { recursive: true, force: true });
  }
});
