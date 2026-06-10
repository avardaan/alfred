import {
  config,
  requireElevenLabsApiKey,
  requireElevenLabsServerUrl,
} from "../config.ts";
import { buildAlfredAgentRequest } from "../elevenlabs/alfred.ts";
import { createElevenLabsClient } from "../elevenlabs/client.ts";
import { ensureGetWeatherTool } from "../elevenlabs/tools.ts";

requireElevenLabsApiKey();
const serverUrl = requireElevenLabsServerUrl();

const client = createElevenLabsClient();

console.log(`Ensuring get_weather tool → ${serverUrl}/tools/get_weather`);
const toolId = await ensureGetWeatherTool(serverUrl, config.elevenLabsWeatherToolId);

if (config.elevenLabsAgentId) {
  console.log(`Updating agent ${config.elevenLabsAgentId}...`);
  await client.conversationalAi.agents.update(config.elevenLabsAgentId, buildAlfredAgentRequest(toolId));
  console.log(`Agent updated: ${config.elevenLabsAgentId}`);
  console.log(`Weather tool id: ${toolId}`);
  console.log("\nAdd to .env if missing:");
  console.log(`ELEVENLABS_WEATHER_TOOL_ID=${toolId}`);
  process.exit(0);
}

console.log("Creating Alfred agent on ElevenLabs...");
const created = await client.conversationalAi.agents.create(buildAlfredAgentRequest(toolId));

console.log(`Agent created: ${created.agentId}`);
console.log(`Weather tool id: ${toolId}`);
console.log("\nAdd to .env (do not commit):");
console.log(`ELEVENLABS_AGENT_ID=${created.agentId}`);
console.log(`ELEVENLABS_WEATHER_TOOL_ID=${toolId}`);
console.log("\nNext:");
console.log("1. In ElevenLabs → Agents → Settings → Webhooks, set post-call URL to:");
console.log(`   ${serverUrl.replace(/\/$/, "")}/webhook/elevenlabs`);
console.log("2. Import Twilio: bun run import:twilio:elevenlabs");
