import {
  config,
  requireElevenLabsApiKey,
  requireElevenLabsServerUrl,
} from "../config.ts";
import { buildAlfredAgentRequest } from "../elevenlabs/alfred.ts";
import { publishAgentUpdate } from "../elevenlabs/agent-sync.ts";
import { createElevenLabsClient } from "../elevenlabs/client.ts";
import { ensureGetWeatherTool } from "../elevenlabs/tools.ts";
import { buildPostCallWebhookUrl, ensurePostCallWebhook } from "../elevenlabs/webhooks.ts";

requireElevenLabsApiKey();
const serverUrl = requireElevenLabsServerUrl();

const client = createElevenLabsClient();

console.log(`Ensuring get_weather tool → ${serverUrl}/tools/get_weather`);
const toolId = await ensureGetWeatherTool(serverUrl, config.elevenLabsWeatherToolId);
const postCallWebhookId = await ensurePostCallWebhook(serverUrl);

if (config.elevenLabsAgentId) {
  console.log(`Publishing agent ${config.elevenLabsAgentId} to Main...`);
  await publishAgentUpdate(
    config.elevenLabsAgentId,
    buildAlfredAgentRequest(toolId, serverUrl, postCallWebhookId),
  );
  console.log(`Agent published: ${config.elevenLabsAgentId}`);
  console.log(`Weather tool id: ${toolId}`);
  console.log("\nAdd to .env if missing:");
  console.log(`ELEVENLABS_WEATHER_TOOL_ID=${toolId}`);
  process.exit(0);
}

console.log("Creating Alfred agent on ElevenLabs...");
const created = await client.conversationalAi.agents.create(
  buildAlfredAgentRequest(toolId, serverUrl, postCallWebhookId),
);

console.log(`Agent created: ${created.agentId}`);
console.log(`Weather tool id: ${toolId}`);
console.log("\nAdd to .env (do not commit):");
console.log(`ELEVENLABS_AGENT_ID=${created.agentId}`);
console.log(`ELEVENLABS_WEATHER_TOOL_ID=${toolId}`);
console.log(`Post-call webhook id: ${postCallWebhookId}`);
console.log(`Post-call URL: ${buildPostCallWebhookUrl(serverUrl)}`);
console.log("\nNext: bun run import:twilio");
