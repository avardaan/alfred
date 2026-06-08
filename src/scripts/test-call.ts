import { config, requireVapiApiKey } from "../config.ts";
import { createVapiClient } from "../vapi/client.ts";

requireVapiApiKey();

const assistantId = config.vapiAssistantId;
const phoneNumberId = config.vapiPhoneNumberId;
const customerNumber = config.vapiTestPhoneNumber;

if (!assistantId) {
  throw new Error("Missing VAPI_ASSISTANT_ID. Run `bun run setup:vapi` first.");
}

if (!customerNumber) {
  throw new Error("Missing VAPI_TEST_PHONE_NUMBER in .env (E.164 format, e.g. +14155551234).");
}

const vapi = createVapiClient();

console.log(`Placing test call to ${customerNumber}...`);

const call = await vapi.calls.create({
  assistantId,
  phoneNumberId,
  customer: { number: customerNumber },
});

console.log(`Call created: ${call.id}`);
console.log(`Status: ${call.status ?? "unknown"}`);
