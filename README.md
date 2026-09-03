# Text Moderation Console

A small React UI for testing the GPS Special API-TXT endpoint
(`https://gps-specials.polydial.com/v1/moderate/text`). Enter a message,
run the check, and see the decision, rewrite, categories, confidence, and
metadata rendered clearly.

## Run with Docker (recommended)

```bash
docker compose up --build
```

Then open **http://localhost:9001**.

Or without compose:

```bash
docker build -t text-moderation-console .
docker run -p 9001:9001 text-moderation-console
```

## Run locally without Docker

```bash
npm install
npm run dev
```

This also serves on port 9001 (see `vite.config.js`).

## About the CORS proxy

The UI calls a same-origin path, `/api/moderate/text`, instead of the
`gps-specials.polydial.com` URL directly. That request is proxied
server-to-server to the real API, so the browser never makes a
cross-origin call and CORS never comes into play:

- **`npm run dev`** — Vite's dev server proxy (`vite.config.js`) forwards
  `/api/*` to `https://gps-specials.polydial.com/v1/*`.
- **Docker / nginx** — `nginx.conf` has an `/api/` reverse-proxy location
  doing the same forwarding inside the container.

This is meant for local/testing convenience. For a real deployment, the
better fix is to have the API itself return the right
`Access-Control-Allow-Origin` header (or keep this proxy pattern
permanently if you'd rather never expose the API's origin to the browser).

## Notes

- The container serves a static production build via nginx on port 9001.
