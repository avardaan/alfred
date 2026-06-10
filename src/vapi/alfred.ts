import type { Vapi } from "@vapi-ai/server-sdk";
import {
  ALFRED_FIRST_MESSAGE,
  ALFRED_SYSTEM_PROMPT,
  ALFRED_VOICE_ID,
} from "../assistant/alfred.ts";
import { ALFRED_TOOLS } from "./tools.ts";

export { ALFRED_SYSTEM_PROMPT } from "../assistant/alfred.ts";

export function buildAlfredAssistant(serverUrl?: string): Vapi.CreateAssistantDto {
  const assistant: Vapi.CreateAssistantDto = {
    name: "Alfred",
    firstMessage: ALFRED_FIRST_MESSAGE,
    firstMessageMode: "assistant-speaks-first",
    firstMessageInterruptionsEnabled: false,
    model: {
      provider: "openai",
      model: "gpt-4o",
      messages: [{ role: "system", content: ALFRED_SYSTEM_PROMPT }],
      tools: ALFRED_TOOLS,
    },
    voice: {
      provider: "11labs",
      voiceId: ALFRED_VOICE_ID,
      enableSsmlParsing: true,
    },
    transcriber: {
      provider: "deepgram",
      model: "nova-2",
      language: "en",
    },
    backgroundSpeechDenoisingPlan: {
      smartDenoisingPlan: { enabled: false },
    },
  };

  if (serverUrl) {
    assistant.server = { url: `${serverUrl.replace(/\/$/, "")}/webhook/vapi` };
  }

  return assistant;
}
