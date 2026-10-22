import http from "node:http";
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { pathToFileURL } from "node:url";
import { randomBytes, randomUUID } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import { World, createPlayer, serialize, hydrateSave } from "../site/core.js";
import { CLASSES, VERSION } from "../site/data.js";

export async function startServer({
  port = Number(process.env.PORT) || 8080,
  host = "0.0.0.0",
  dataDir = process.env.LEAFTALE_DATA_DIR || resolve("server/data"),
  allowedOrigins = (
    process.env.LEAFTALE_ORIGINS ||
    "https://haenohub.github.io,http://localhost:8080,http://127.0.0.1:8080"
  ).split(","),
} = {}) {
  await mkdir(dataDir, { recursive: true });
  const storePath = resolve(dataDir, "sessions.json");
  let sessions = Object.create(null);
  try {
    const raw = JSON.parse(await readFile(storePath, "utf8"));
    for (const [token, value] of Object.entries(raw))
      if (/^[\w-]{43}$/.test(token) && hydrateSave(value.player))
        sessions[token] = value;
  } catch (e) {
    if (e.code !== "ENOENT")
      throw new Error(
        "Could not read session storage; refusing to overwrite it.",
      );
  }
  const world = new World({ seed: Date.now() }),
    clients = new Map(),
    activeTokens = new Set();
  let writes = Promise.resolve();
  const persist = () => {
    for (const [ws, c] of clients)
      if (c.id && world.players.has(c.id))
        sessions[c.token] = {
          player: serialize(world.players.get(c.id)),
          lastSeen: Date.now(),
        };
    const json = JSON.stringify(sessions);
    writes = writes.then(async () => {
      const temp = storePath + ".tmp";
      await writeFile(temp, json, { mode: 0o600 });
      await rename(temp, storePath);
    });
    return writes;
  };
  const root = resolve("dist");
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405).end();
      return;
    }
    if (url.pathname === "/health") {
      res.writeHead(200, {
        "content-type": "application/json",
        "cache-control": "no-store",
      });
      res.end(
        JSON.stringify({
          status: "ok",
          version: VERSION,
          players: world.players.size,
        }),
      );
      return;
    }
    try {
      const file = resolve(
        root,
        "." +
          decodeURIComponent(
            url.pathname === "/" ? "/index.html" : url.pathname,
          ),
      );
      if (!file.startsWith(root + "/")) {
        res.writeHead(403).end();
        return;
      }
      const body = await readFile(file),
        type =
          {
            ".html": "text/html; charset=utf-8",
            ".js": "text/javascript; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".png": "image/png",
            ".json": "application/json",
          }[extname(file)] || "application/octet-stream";
      res.writeHead(200, {
        "content-type": type,
        "x-content-type-options": "nosniff",
        "cache-control": "no-cache",
      });
      res.end(req.method === "HEAD" ? undefined : body);
    } catch {
      res.writeHead(404).end();
    }
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 8192 });
  server.on("upgrade", (req, socket, head) => {
    if (
      new URL(req.url, "http://localhost").pathname !== "/ws" ||
      (req.headers.origin && !allowedOrigins.includes(req.headers.origin)) ||
      clients.size >= 128
    ) {
      socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) =>
      wss.emit("connection", ws, req),
    );
  });
  const reply = (ws, data) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
  };
  wss.on("connection", (ws) => {
    const c = {
      joined: false,
      id: null,
      token: null,
      count: 0,
      window: Date.now(),
      lastMove: Date.now(),
      lastChat: 0,
    };
    clients.set(ws, c);
    const joinTimer = setTimeout(() => {
      if (!c.joined) ws.close(1008, "Join required");
    }, 5000);
    ws.on("message", (bytes) => {
      if (Date.now() - c.window > 1000) {
        c.count = 0;
        c.window = Date.now();
      }
      if (++c.count > 60) {
        ws.close(1008, "Rate limit");
        return;
      }
      let msg;
      try {
        msg = JSON.parse(bytes.toString());
      } catch {
        return;
      }
      if (!msg || typeof msg !== "object") return;
      if (msg.type === "join" && !c.joined) {
        if (activeTokens.has(msg.token)) {
          reply(ws, {
            type: "error",
            message: "이 모험은 이미 다른 창에서 접속 중입니다.",
          });
          return;
        }
        const existing =
          typeof msg.token === "string" && Object.hasOwn(sessions, msg.token)
            ? sessions[msg.token]
            : null;
        if (!existing && !CLASSES.some((cls) => cls.id === msg.classId)) {
          reply(ws, { type: "error", message: "올바른 직업을 선택해 주세요." });
          return;
        }
        c.token = existing ? msg.token : randomBytes(32).toString("base64url");
        c.id = randomUUID();
        world.addPlayer(
          existing?.player || createPlayer(msg.classId, msg.name),
          c.id,
        );
        activeTokens.add(c.token);
        c.joined = true;
        clearTimeout(joinTimer);
        sessions[c.token] = {
          player: serialize(world.players.get(c.id)),
          lastSeen: Date.now(),
        };
        reply(ws, { type: "welcome", token: c.token });
        reply(ws, { type: "state", state: world.snapshot(c.id) });
        return;
      }
      if (!c.joined) return;
      if (msg.type === "action") {
        if (msg.action?.type === "move" || msg.action?.type === "moveTo")
          c.lastMove = Date.now();
        // World.act accepts only explicit actions and computes all rewards on the server.
        world.act(c.id, msg.action);
      }
      if (
        msg.type === "chat" &&
        typeof msg.text === "string" &&
        Date.now() - c.lastChat > 650
      ) {
        c.lastChat = Date.now();
        const p = world.players.get(c.id),
          text = msg.text
            .replace(/[\u0000-\u001f]/g, "")
            .trim()
            .slice(0, 160);
        if (!text) return;
        for (const [peer, pc] of clients)
          if (pc.joined && world.players.get(pc.id)?.map === p.map)
            reply(peer, { type: "chat", name: p.name, text });
      }
    });
    ws.on("error", () => {});
    ws.on("close", () => {
      clearTimeout(joinTimer);
      if (c.joined) {
        const p = world.players.get(c.id);
        if (p)
          sessions[c.token] = { player: serialize(p), lastSeen: Date.now() };
        world.players.delete(c.id);
        activeTokens.delete(c.token);
      }
      clients.delete(ws);
      persist().catch(() => console.error("Session persistence failed"));
    });
  });
  const tick = setInterval(() => {
    for (const c of clients.values())
      if (c.joined && Date.now() - c.lastMove > 1000) {
        const p = world.players.get(c.id);
        if (p) p.move = { x: 0, y: 0 };
      }
    world.step(0.05);
  }, 50);
  const broadcast = setInterval(() => {
    for (const [ws, c] of clients)
      if (c.joined) reply(ws, { type: "state", state: world.snapshot(c.id) });
  }, 100);
  const saveTimer = setInterval(
    () => persist().catch(() => console.error("Session persistence failed")),
    5000,
  );
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });
  return {
    server,
    world,
    port: server.address().port,
    async close() {
      clearInterval(tick);
      clearInterval(broadcast);
      clearInterval(saveTimer);
      await persist();
      for (const ws of clients.keys()) ws.terminate();
      await new Promise((resolve) => wss.close(resolve));
      await new Promise((resolve) => server.close(resolve));
      await writes;
    },
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const app = await startServer();
  console.log(
    `LeafTale HTTP and WebSocket server listening on port ${app.port}`,
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.once(signal, async () => {
      await app.close();
      process.exit(0);
    });
}
