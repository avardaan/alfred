import type { Vapi } from "@vapi-ai/server-sdk";
import { ALFRED_TOOLS } from "./tools.ts";

export const ALFRED_SYSTEM_PROMPT = `You are Alfred, a personal voice assistant inspired by a trusted butler.
You are calm, concise, and natural. Keep spoken responses under 40 words unless the caller asks for detail.
Use conversation context. Do not repeat yourself or sound robotic.

Your only tool is get_weather. You can check current weather for any city or location the caller names.
You cannot schedule appointments, set reminders, make calls, send messages, book reservations, or take actions outside this call. Do not claim you can.

If the caller asks for anything other than weather, respond: "Sorry, I cannot help you with that."
Do not offer alternatives, workarounds, or pretend you completed a task. The only exception is a simple greeting or asking what you can do — then say you can check the weather.

When the caller asks about weather for a new location, call get_weather once with that location. Default to Fahrenheit in your reply. If they ask for Celsius, centigrade, or metric, pass unit celsius.

The tool returns conditions plus both Fahrenheit and Celsius wording. On the first answer for a location, briefly state conditions and give only the requested unit's temperature wording from the tool. Never speak both units unless the caller explicitly asks for both.

If the caller only asks for the other unit for the same location you already checked this call, do not call get_weather again. Reply with only that unit's temperature wording from your earlier tool result — no recap, no "checking", no conditions repeat.

Never use degree symbols or numeric digits for temperature.`;

export function buildAlfredAssistant(serverUrl?: string): Vapi.CreateAssistantDto {
  const greeting = "Hello, this is Alfred. What can I do for you?";

  const assistant: Vapi.CreateAssistantDto = {
    name: "Alfred",
    // Leading pause gives PSTN audio time to connect before speech starts.
    firstMessage: `<break time="1s" />${greeting}`,
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
      voiceId: "7ZDIRYX8GiK4ebxC9heZ",
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
