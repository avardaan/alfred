import { VapiClient } from "@vapi-ai/server-sdk";
import { requireVapiApiKey } from "../config.ts";

export function createVapiClient(): VapiClient {
  return new VapiClient({ token: requireVapiApiKey() });
}
