# Quick Draw Web

## Local development

Start the backend from `../server`, then run the web app with Vite:

```bash
npm install
npm run dev
```

The server's `npm run dev` command now enables local HTTPS on `https://localhost:3001`.

The Vite dev server now runs on HTTPS locally using a generated self-signed certificate.
Open the printed `https://localhost:5173` URL and accept the browser warning once if prompted.

## WebSocket behavior

In development, the client connects back to the current page origin and Vite proxies `/socket.io` to the local backend on port `3001` over HTTPS.
That keeps browser traffic on `https://` and upgrades Socket.IO connections over `wss://` instead of `ws://`.
