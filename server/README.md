# LeafTale realtime server

Node.js 24. The same `World` rules run locally and on the authoritative server. Two actual WebSocket clients and two browser sessions were tested locally. This is a small cooperative prototype, not a load-tested MMO service.

```sh
npm ci --ignore-scripts
npm run build
PORT=8080 LEAFTALE_DATA_DIR=/persistent/leaftale LEAFTALE_ORIGINS=https://haenohub.github.io npm start
```

- `PORT`: listening port, default 8080.
- `LEAFTALE_DATA_DIR`: directory for atomic `sessions.json` writes. Must use persistent storage in public hosting. Default `server/data`, ignored by Git.
- `LEAFTALE_ORIGINS`: comma-separated exact browser origins. Defaults include the GitHub Pages origin and localhost development origins. No wildcard default.
- `GET /health`: JSON status and connection count.
- `WS /ws`: join, input actions, snapshots and map-local chat.

Serve behind a TLS-terminating host/reverse proxy and connect the Pages game to `wss://YOUR-HOST/ws` through Settings. The node server can also serve the static `dist` directory for local development.

Guest sessions use randomly generated reconnect tokens. These are separate from browser-only saves. Do not expose the persistence directory or log session tokens. This prototype does not yet provide account passwords, email recovery, OAuth, trading, guilds, or anti-bot protection. Exporting local saves does not grant authority to import data into a server session.

The server accepts bounded movement and explicit actions, computes damage/XP/loot/crafting/quest rewards itself, restricts cross-origin upgrades, limits incoming message size and rate, and broadcasts only same-map peers. Disconnect removes the live player and preserves the guest save. SIGINT/SIGTERM flush persistence.

Deployment must be verified with a persistent-volume restart and two browsers over WSS before claiming public multiplayer readiness.
