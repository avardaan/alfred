import {
  config,
  requireElevenLabsApiKey,
  requireElevenLabsServerUrl,
} from "../config.ts";
import { buildAlfredAgentRequest } from "../elevenlabs/alfred.ts";
import { buildAlfredOutboundAgentRequest } from "../elevenlabs/alfred-outbound.ts";
import { publishAgentUpdate } from "../elevenlabs/agent-sync.ts";
import { createElevenLabsClient } from "../elevenlabs/client.ts";
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

const client = createElevenLabsClient();

console.log("Ensuring webhook secret...");
const webhookSecretId = await ensureWebhookSecret();
console.log(`Webhook secret: ${webhookSecretId}`);

console.log("\nEnsuring post-call webhook...");
const postCallWebhook = await ensurePostCallWebhook();
console.log(`Post-call webhook ID: ${postCallWebhook.webhookId}`);

console.log(`\nEnsuring tools → ${serverUrl}`);
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

console.log(`Weather tool: ${weatherToolId}`);
console.log(`Submit task result tool: ${submitResultToolId}`);
console.log(`Create task tool: ${createTaskToolId}`);
console.log(`Lookup business tool: ${lookupBusinessToolId}`);

// --- Inbound (Alfred) agent ---
if (config.elevenLabsAgentId) {
  console.log(`\nPublishing inbound agent ${config.elevenLabsAgentId} to Main...`);
  await publishAgentUpdate(
    config.elevenLabsAgentId,
    buildAlfredAgentRequest(
      [weatherToolId, createTaskToolId, lookupBusinessToolId],
      serverUrl,
      webhookSecretId,
    ),
  );
  console.log(`Inbound agent published: ${config.elevenLabsAgentId}`);
} else {
  console.log("\nCreating Alfred (inbound) agent on ElevenLabs...");
  const created = await client.conversationalAi.agents.create(
    buildAlfredAgentRequest(
      [weatherToolId, createTaskToolId, lookupBusinessToolId],
      serverUrl,
      webhookSecretId,
    ),
  );
  console.log(`Inbound agent created: ${created.agentId}`);
  console.log(`\nAdd to .env (do not commit):`);
  console.log(`ELEVENLABS_AGENT_ID=${created.agentId}`);
}

// --- Outbound (Alfred Outbound) agent ---
if (config.elevenLabsOutboundAgentId) {
  console.log(`\nPublishing outbound agent ${config.elevenLabsOutboundAgentId} to Main...`);
  await publishAgentUpdate(
    config.elevenLabsOutboundAgentId,
    buildAlfredOutboundAgentRequest(submitResultToolId),
  );
  console.log(`Outbound agent published: ${config.elevenLabsOutboundAgentId}`);
} else {
  console.log("\nCreating Alfred Outbound agent on ElevenLabs...");
  const created = await client.conversationalAi.agents.create(
    buildAlfredOutboundAgentRequest(submitResultToolId),
  );
  console.log(`Outbound agent created: ${created.agentId}`);
  console.log(`\nAdd to .env (do not commit):`);
  console.log(`ELEVENLABS_OUTBOUND_AGENT_ID=${created.agentId}`);
}

console.log("\n--- All IDs ---");
console.log(`ELEVENLABS_AGENT_ID=${config.elevenLabsAgentId ?? "(new — see above)"}`);
console.log(`ELEVENLABS_OUTBOUND_AGENT_ID=${config.elevenLabsOutboundAgentId ?? "(new — see above)"}`);
console.log(`ELEVENLABS_WEATHER_TOOL_ID=${weatherToolId}`);
console.log(`ELEVENLABS_SUBMIT_TASK_RESULT_TOOL_ID=${submitResultToolId}`);
console.log(`ELEVENLABS_CREATE_TASK_TOOL_ID=${createTaskToolId}`);
console.log(`ELEVENLABS_LOOKUP_BUSINESS_TOOL_ID=${lookupBusinessToolId}`);
console.log(`ELEVENLABS_WEBHOOK_SECRET_ID=${webhookSecretId}`);
console.log(`ELEVENLABS_POST_CALL_WEBHOOK_ID=${postCallWebhook.webhookId}`);
if (postCallWebhook.webhookSecret) {
  console.log(`ELEVENLABS_POST_CALL_WEBHOOK_SECRET=${postCallWebhook.webhookSecret}`);
}
console.log("\nNext: bun run sync:agent");
