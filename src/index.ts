import { config } from "./config.ts";
import { handleVapiWebhook } from "./routes/webhook.ts";

const server = Bun.serve({
  port: config.port,
  routes: {
    "/health": () => Response.json({ status: "ok" }),
    "/webhook/vapi": {
      POST: handleVapiWebhook,
    },
  },
  fetch() {
    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Alfred listening on http://localhost:${server.port}`);
