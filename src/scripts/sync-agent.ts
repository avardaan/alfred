import { config, requireElevenLabsApiKey, requireElevenLabsServerUrl } from "../config.ts";
import { buildAlfredAgentRequest } from "../elevenlabs/alfred.ts";
import { buildAlfredOutboundAgentRequest } from "../elevenlabs/alfred-outbound.ts";
import { publishAgentUpdate } from "../elevenlabs/agent-sync.ts";
import {
  ensureCreateTaskTool,
  ensureGetWeatherTool,
  ensureLookupBusinessTool,
  ensureSubmitTaskResultTool,
} from "../elevenlabs/tools.ts";
import { ensureWebhookSecret } from "../elevenlabs/secrets.ts";
import { ensurePostCallWebhook } from "../elevenlabs/post-call-webhook.ts";

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

console.log("Ensuring webhook secret...");
const webhookSecretId = await ensureWebhookSecret();
console.log(`Webhook secret: ${webhookSecretId}`);

console.log("\nEnsuring post-call webhook...");
const postCallWebhook = await ensurePostCallWebhook();
console.log(`Post-call webhook: ${postCallWebhook.webhookId}`);

console.log("\nEnsuring tools...");
const weatherToolId = await ensureGetWeatherTool(
  serverUrl,
  webhookSecretId,
  config.elevenLabsWeatherToolId,
);
const submitResultToolId = await ensureSubmitTaskResultTool(
  serverUrl,
  webhookSecretId,
  config.elevenLabsSubmitTaskResultToolId,
);
const createTaskToolId = await ensureCreateTaskTool(
  serverUrl,
  webhookSecretId,
  config.elevenLabsCreateTaskToolId,
);
const lookupBusinessToolId = await ensureLookupBusinessTool(
  serverUrl,
  webhookSecretId,
  config.elevenLabsLookupBusinessToolId,
);

console.log(`\nPublishing inbound agent ${agentId} to Main...`);
await publishAgentUpdate(
  agentId,
  buildAlfredAgentRequest(
    [weatherToolId, createTaskToolId, lookupBusinessToolId],
    serverUrl,
    webhookSecretId,
  ),
);

console.log(`Publishing outbound agent ${outboundAgentId} to Main...`);
await publishAgentUpdate(outboundAgentId, buildAlfredOutboundAgentRequest(submitResultToolId));

console.log("\nAgents published.");
console.log(`Weather tool: ${weatherToolId}`);
console.log(`Submit task result tool: ${submitResultToolId}`);
console.log(`Create task tool: ${createTaskToolId}`);
console.log(`Lookup business tool: ${lookupBusinessToolId}`);
console.log(`Webhook secret: ${webhookSecretId}`);
console.log(`Post-call webhook: ${postCallWebhook.webhookId}`);
