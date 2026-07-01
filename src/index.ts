import { config } from "./config.ts";
import { handleElevenLabsInitWebhook } from "./routes/elevenlabs-init-webhook.ts";
import { handleGetWeatherTool } from "./routes/get-weather-tool.ts";
import { handleCreateTaskTool } from "./tools/create-task.ts";
import { handleLookupBusinessTool } from "./tools/lookup-business.ts";
import { handleSubmitTaskResultTool } from "./tools/submit-task-result.ts";

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
    "/tools/create_task": {
      POST: handleCreateTaskTool,
    },
    "/tools/lookup_business": {
      POST: handleLookupBusinessTool,
    },
    "/tools/submit_task_result": {
      POST: handleSubmitTaskResultTool,
    },
  },
  fetch() {
    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Alfred listening on http://localhost:${server.port}`);
