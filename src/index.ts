import { config } from "./config.ts";
import { handleElevenLabsInitWebhook } from "./routes/elevenlabs-init-webhook.ts";
import { handleGetWeatherTool } from "./routes/get-weather-tool.ts";

const server = Bun.serve({
  port: config.port,
  hostname: "0.0.0.0",
  routes: {
    "/": () =>
      new Response("Hello, this is Alfred. What can I do for you?", {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      }),
    "/health": () => Response.json({ status: "ok" }),
    "/webhook/elevenlabs/init": {
      POST: handleElevenLabsInitWebhook,
    },
    "/tools/get_weather": {
      POST: handleGetWeatherTool,
    },
  },
  fetch() {
    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Alfred listening on http://localhost:${server.port}`);
