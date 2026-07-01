import { config, requireElevenLabsApiKey, requireElevenLabsServerUrl } from "../config.ts";
import { buildAlfredAgentRequest } from "../elevenlabs/alfred.ts";
import { buildAlfredOutboundAgentRequest } from "../elevenlabs/alfred-outbound.ts";
import { publishAgentUpdate } from "../elevenlabs/agent-sync.ts";
import {
  ensureCreateTaskTool,
  ensureGetWeatherTool,
  ensureSubmitTaskResultTool,
} from "../elevenlabs/tools.ts";

requireElevenLabsApiKey();
const serverUrl = requireElevenLabsServerUrl();

const agentId = config.elevenLabsAgentId;
const outboundAgentId = config.elevenLabsOutboundAgentId;

if (!agentId) {
  throw new Error("Missing ELEVENLABS_AGENT_ID. Run `bun run setup` first.");
}
if (!outboundAgentId) {
  throw new Error("Missing ELEVENLABS_OUTBOUND_AGENT_ID. Run `bun run setup` first.");
}

console.log("Ensuring tools...");
const weatherToolId = await ensureGetWeatherTool(serverUrl, config.elevenLabsWeatherToolId);
const submitResultToolId = await ensureSubmitTaskResultTool(
  serverUrl,
  config.elevenLabsSubmitTaskResultToolId,
);
const createTaskToolId = await ensureCreateTaskTool(serverUrl, config.elevenLabsCreateTaskToolId);

console.log(`\nPublishing inbound agent ${agentId} to Main...`);
await publishAgentUpdate(
  agentId,
  buildAlfredAgentRequest([weatherToolId, createTaskToolId], serverUrl),
);

console.log(`Publishing outbound agent ${outboundAgentId} to Main...`);
await publishAgentUpdate(outboundAgentId, buildAlfredOutboundAgentRequest(submitResultToolId));

console.log("\nAgents published.");
console.log(`Weather tool: ${weatherToolId}`);
console.log(`Submit task result tool: ${submitResultToolId}`);
console.log(`Create task tool: ${createTaskToolId}`);
