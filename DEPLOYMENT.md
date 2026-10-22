# GitHub Pages deployment test

This is a static deployment smoke test for 리프테일. It does not implement the game or an online game server.

## Local verification

Use Node.js 24, then run from `/workspace/trick`:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run build
npm test
```

To inspect it locally, serve `dist` with a static HTTP server. Assets use relative URLs so the published project path `/trick/` works.

## Automatic deployment

In the repository settings, set Pages → Build and deployment → Source to GitHub Actions. The workflow builds and tests pull requests. Pushes to `main` and manual runs on `main` also publish `dist` to the `github-pages` environment. No personal deployment token is required: the job uses GitHub's scoped token and OIDC.

After deployment, the workflow requests the public page, stylesheet, script, and `deployment.json`. It fails if the public metadata does not match that run's full commit SHA. A successful upload alone is not considered verified deployment.

Expected project address: https://haenohub.github.io/trick/ (subject to the repository's Pages/custom-domain settings).

For verification from this cloud environment, allow `api.github.com` and `haenohub.github.io` in environment network settings. A network-policy change saved as a draft does not itself update the running machine.

## Next game stage

Replace this smoke page and adjust its checks when implementing the game. GitHub Pages serves static frontend files. Multiplayer, authoritative loot, accounts, and server-side saves require a separate backend.
