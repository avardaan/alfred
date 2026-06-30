import { config, requireElevenLabsApiKey, requireElevenLabsServerUrl } from "../config.ts";
import { publishAgentUpdate } from "../elevenlabs/agent-sync.ts";
import { buildAlfredAgentRequest } from "../elevenlabs/alfred.ts";
import { ensureGetWeatherTool } from "../elevenlabs/tools.ts";

requireElevenLabsApiKey();
const serverUrl = requireElevenLabsServerUrl();

const agentId = config.elevenLabsAgentId;
if (!agentId) {
  throw new Error("Missing ELEVENLABS_AGENT_ID. Run `bun run setup` first.");
}

const toolId = await ensureGetWeatherTool(serverUrl, config.elevenLabsWeatherToolId);

console.log(`Publishing agent ${agentId} to Main...`);
await publishAgentUpdate(agentId, buildAlfredAgentRequest(toolId, serverUrl));

console.log("Agent published.");
console.log(`Weather tool id: ${toolId}`);
