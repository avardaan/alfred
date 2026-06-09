import { config, requireVapiApiKey } from "../config.ts";
import { createVapiClient } from "../vapi/client.ts";

requireVapiApiKey();

const assistantId = config.vapiAssistantId;
if (!assistantId) {
  throw new Error("Missing VAPI_ASSISTANT_ID. Run `bun run setup:vapi` first.");
}

const { twilioAccountSid, twilioAuthToken, twilioPhoneNumber } = config;

if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
  throw new Error(
    "Missing Twilio config. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER (E.164) in .env.",
  );
}

const vapi = createVapiClient();

console.log(`Importing Twilio number ${twilioPhoneNumber} into Vapi...`);

const phoneNumber = await vapi.phoneNumbers.create({
  provider: "twilio",
  number: twilioPhoneNumber,
  twilioAccountSid,
  twilioAuthToken,
  name: "Alfred Line (Twilio)",
  assistantId,
});

console.log(`Phone number imported: ${phoneNumber.number ?? twilioPhoneNumber}`);
console.log(`Phone number id: ${phoneNumber.id}`);
console.log("\nUpdate your .env (do not commit it):");
console.log(`VAPI_PHONE_NUMBER_ID=${phoneNumber.id}`);
