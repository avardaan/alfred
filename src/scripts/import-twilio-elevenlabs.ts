import { config, requireElevenLabsApiKey } from "../config.ts";
import { createElevenLabsClient } from "../elevenlabs/client.ts";

requireElevenLabsApiKey();

const agentId = config.elevenLabsAgentId;
if (!agentId) {
  throw new Error("Missing ELEVENLABS_AGENT_ID. Run `bun run setup:elevenlabs` first.");
}

const { twilioAccountSid, twilioAuthToken, twilioPhoneNumber } = config;

if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
  throw new Error(
    "Missing Twilio config. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER (E.164) in .env.",
  );
}

const client = createElevenLabsClient();

console.log(`Importing Twilio number ${twilioPhoneNumber} into ElevenLabs...`);

const phoneNumber = await client.conversationalAi.phoneNumbers.create({
  provider: "twilio",
  phoneNumber: twilioPhoneNumber,
  label: "Alfred Line (Twilio)",
  sid: twilioAccountSid,
  token: twilioAuthToken,
});

await client.conversationalAi.phoneNumbers.update(phoneNumber.phoneNumberId, {
  agentId,
});

console.log(`Phone number imported: ${twilioPhoneNumber}`);
console.log(`Phone number id: ${phoneNumber.phoneNumberId}`);
console.log(`Linked to agent: ${agentId}`);
console.log("\nUpdate your .env (do not commit it):");
console.log(`ELEVENLABS_PHONE_NUMBER_ID=${phoneNumber.phoneNumberId}`);
console.log("\nNote: release the number from Vapi before importing if you get a conflict error.");
