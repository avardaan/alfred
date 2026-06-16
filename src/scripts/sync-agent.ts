import { config, requireElevenLabsApiKey, requireElevenLabsServerUrl } from "../config.ts";
import { publishAgentUpdate } from "../elevenlabs/agent-sync.ts";
import { buildAlfredAgentRequest } from "../elevenlabs/alfred.ts";
import { ensureGetWeatherTool } from "../elevenlabs/tools.ts";
import { buildPostCallWebhookUrl, ensurePostCallWebhook } from "../elevenlabs/webhooks.ts";

requireElevenLabsApiKey();
const serverUrl = requireElevenLabsServerUrl();

const agentId = config.elevenLabsAgentId;
if (!agentId) {
  throw new Error("Missing ELEVENLABS_AGENT_ID. Run `bun run setup` first.");
}

const toolId = await ensureGetWeatherTool(serverUrl, config.elevenLabsWeatherToolId);
const postCallWebhookId = await ensurePostCallWebhook(serverUrl);

console.log(`Publishing agent ${agentId} to Main...`);
await publishAgentUpdate(agentId, buildAlfredAgentRequest(toolId, serverUrl, postCallWebhookId));

console.log("Agent published.");
console.log(`Weather tool id: ${toolId}`);
console.log(`Post-call webhook id: ${postCallWebhookId}`);
console.log(`Post-call URL: ${buildPostCallWebhookUrl(serverUrl)}`);
