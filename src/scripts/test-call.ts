import { config, requireElevenLabsApiKey } from "../config.ts";
import { createElevenLabsClient } from "../elevenlabs/client.ts";

requireElevenLabsApiKey();

const agentId = config.elevenLabsAgentId;
const phoneNumberId = config.elevenLabsPhoneNumberId;
const customerNumber = config.elevenLabsTestPhoneNumber;

if (!agentId) {
  throw new Error("Missing ELEVENLABS_AGENT_ID. Run `bun run setup` first.");
}

if (!phoneNumberId) {
  throw new Error("Missing ELEVENLABS_PHONE_NUMBER_ID. Run `bun run import:twilio` first.");
}

if (!customerNumber) {
  throw new Error(
    "Missing ELEVENLABS_TEST_PHONE_NUMBER in .env (E.164 format, e.g. +14155551234).",
  );
}

const client = createElevenLabsClient();

console.log(`Placing test call to ${customerNumber}...`);

const call = await client.conversationalAi.twilio.outboundCall({
  agentId,
  agentPhoneNumberId: phoneNumberId,
  toNumber: customerNumber,
});

console.log(`Call created: ${call.conversationId ?? call.callSid ?? "unknown"}`);
console.log(`Success: ${call.success ?? true}`);
