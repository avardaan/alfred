import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { requireElevenLabsApiKey } from "../config.ts";

export function createElevenLabsClient(): ElevenLabsClient {
  return new ElevenLabsClient({ apiKey: requireElevenLabsApiKey() });
}
