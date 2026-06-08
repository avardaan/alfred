import type { Vapi } from "@vapi-ai/server-sdk";
import { ALFRED_TOOLS } from "./tools.ts";

export const ALFRED_SYSTEM_PROMPT = `You are Alfred, a personal voice assistant inspired by a trusted butler.
You are calm, concise, and capable. Keep spoken responses under 40 words unless the caller asks for detail.
Help with scheduling, reminders, weather lookups, and everyday tasks. If you cannot do something, say so plainly and offer the next best step.
When the caller asks about weather, use the get_weather tool with the city or location they mention.`;

export function buildAlfredAssistant(serverUrl?: string): Vapi.CreateAssistantDto {
  const assistant: Vapi.CreateAssistantDto = {
    name: "Alfred",
    firstMessage: "Hello, this is Alfred calling on behalf of Vardaan Aashish.",
    model: {
      provider: "openai",
      model: "gpt-4o",
      messages: [{ role: "system", content: ALFRED_SYSTEM_PROMPT }],
      tools: ALFRED_TOOLS,
    },
    voice: {
      provider: "11labs",
      voiceId: "burt",
    },
    transcriber: {
      provider: "deepgram",
      model: "nova-2",
      language: "en",
    },
  };

  if (serverUrl) {
    assistant.server = { url: `${serverUrl.replace(/\/$/, "")}/webhook/vapi` };
  }

  return assistant;
}
