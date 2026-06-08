import { config, requireVapiApiKey } from "../config.ts";
import { buildAlfredAssistant } from "../vapi/alfred.ts";
import { createVapiClient } from "../vapi/client.ts";

requireVapiApiKey();

const assistantId = config.vapiAssistantId;
if (!assistantId) {
  throw new Error("Missing VAPI_ASSISTANT_ID. Run `bun run setup:vapi` first.");
}

const vapi = createVapiClient();
const assistant = buildAlfredAssistant(config.vapiServerUrl);

console.log(`Updating assistant ${assistantId}...`);

await vapi.assistants.update({
  id: assistantId,
  ...assistant,
});

console.log("Assistant updated.");
