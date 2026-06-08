import type { Vapi } from "@vapi-ai/server-sdk";
import { ALFRED_TOOLS } from "./tools.ts";

export const ALFRED_SYSTEM_PROMPT = `You are Alfred, a personal voice assistant inspired by a trusted butler.
You are calm, concise, and capable. Keep spoken responses under 40 words unless the caller asks for detail.

Your only tool is get_weather. You can check current weather for any city or location the caller names.
You cannot schedule appointments, set reminders, make calls, send messages, book reservations, or take actions outside this call. Do not claim you can.

If the caller asks for anything other than weather, respond: "Sorry, I cannot help you with that."
Do not offer alternatives, workarounds, or pretend you completed a task. The only exception is a simple greeting or asking what you can do — then say you can check the weather.

When the caller asks about weather, temperature, or conditions, use get_weather with the location they mention.`;

export function buildAlfredAssistant(serverUrl?: string): Vapi.CreateAssistantDto {
  const assistant: Vapi.CreateAssistantDto = {
    name: "Alfred",
    firstMessage: "Good evening. Alfred at your service. How may I help you?",
    firstMessageInterruptionsEnabled: true,
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
    backgroundSpeechDenoisingPlan: {
      smartDenoisingPlan: { enabled: false },
    },
  };

  if (serverUrl) {
    assistant.server = { url: `${serverUrl.replace(/\/$/, "")}/webhook/vapi` };
  }

  return assistant;
}
