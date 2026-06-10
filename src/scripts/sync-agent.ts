import { config, requireElevenLabsApiKey, requireElevenLabsServerUrl } from "../config.ts";
import { buildAlfredAgentRequest } from "../elevenlabs/alfred.ts";
import { createElevenLabsClient } from "../elevenlabs/client.ts";
import { ensureGetWeatherTool } from "../elevenlabs/tools.ts";

requireElevenLabsApiKey();
const serverUrl = requireElevenLabsServerUrl();

const agentId = config.elevenLabsAgentId;
if (!agentId) {
  throw new Error("Missing ELEVENLABS_AGENT_ID. Run `bun run setup` first.");
}

const client = createElevenLabsClient();
const toolId = await ensureGetWeatherTool(serverUrl, config.elevenLabsWeatherToolId);

console.log(`Updating agent ${agentId}...`);
await client.conversationalAi.agents.update(agentId, buildAlfredAgentRequest(toolId));

console.log("Agent updated.");
console.log(`Weather tool id: ${toolId}`);
