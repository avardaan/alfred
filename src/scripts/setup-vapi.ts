import { config, requireVapiApiKey } from "../config.ts";
import { buildAlfredAssistant } from "../vapi/alfred.ts";
import { createVapiClient } from "../vapi/client.ts";

requireVapiApiKey();

const vapi = createVapiClient();
const serverUrl = config.vapiServerUrl;

if (!serverUrl) {
  console.warn(
    "VAPI_SERVER_URL is not set. The assistant will be created without a webhook URL.",
  );
  console.warn("Set it to your public URL (e.g. ngrok) and re-run setup to enable webhooks.");
}

console.log("Creating Alfred assistant...");

const assistant = await vapi.assistants.create(buildAlfredAssistant(serverUrl));

console.log(`Assistant created: ${assistant.id}`);

console.log("Creating phone number...");

const phoneNumber = await vapi.phoneNumbers.create({
  provider: "vapi",
  name: "Alfred Line",
  assistantId: assistant.id,
  numberDesiredAreaCode: config.vapiAreaCode,
});

console.log(`Phone number created: ${phoneNumber.number ?? "(pending)"}`);
console.log(`Phone number id: ${phoneNumber.id}`);

console.log("\nAdd these to your local .env file (do not commit .env):");
console.log(`VAPI_ASSISTANT_ID=${assistant.id}`);
console.log(`VAPI_PHONE_NUMBER_ID=${phoneNumber.id}`);
if (serverUrl) {
  console.log(`VAPI_SERVER_URL=${serverUrl}`);
}
