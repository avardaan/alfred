import { config } from "./config.ts";
import { handleVapiWebhook } from "./routes/webhook.ts";

const server = Bun.serve({
  port: config.port,
  hostname: "0.0.0.0",
  routes: {
    "/": () =>
      new Response("Hello, this is Alfred. What can I do for you?", {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      }),
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
