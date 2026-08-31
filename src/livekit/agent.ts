import { cli, defineAgent, llm, voice, WorkerOptions } from "@livekit/agents";
import * as deepgram from "@livekit/agents-plugin-deepgram";
import * as elevenlabs from "@livekit/agents-plugin-elevenlabs";
import * as openai from "@livekit/agents-plugin-openai";
import * as silero from "@livekit/agents-plugin-silero";
import { fileURLToPath } from "node:url";
import { z } from "zod";

import { ALFRED_SYSTEM_PROMPT } from "../assistant/alfred.ts";
import { createEpisode } from "../db/episodes.ts";
import { createTask } from "../db/tasks.ts";
import { findUserByPhone, greetingForUser, normalizePhone } from "../db/users.ts";
import { findBusinessPhone } from "../tools/places.ts";
import { getWeather } from "../tools/weather.ts";

/**
 * Alfred In-Process Voice Agent Tools
 * Executed directly inside the Bun process with zero HTTP webhook overhead.
 */
const weatherTool = llm.tool({
  description: "Check current weather for a city or region.",
  parameters: z.object({
    location: z.string().describe("City, state, or location name"),
    unit: z.enum(["fahrenheit", "celsius"]).optional().describe("Temperature unit"),
  }),
  execute: async ({ location, unit }) => {
    console.log(`[livekit/tool] get_weather location="${location}"`);
    return await getWeather(location, unit ?? "fahrenheit");
  },
});

const lookupBusinessTool = llm.tool({
  description: "Look up a business name, address, phone number, and hours via Google Places.",
  parameters: z.object({
    query: z.string().describe("Business name and optional city (e.g. 'Philz Coffee San Francisco')"),
  }),
  execute: async ({ query }) => {
    console.log(`[livekit/tool] lookup_business query="${query}"`);
    const place = await findBusinessPhone(query);
    if (!place) {
      return `I could not find a business matching "${query}".`;
    }
    const hoursText = place.hours ? ` Hours: ${place.hours}.` : "";
    return `Found ${place.name} at ${place.address}. Phone number: ${place.phoneNumber}.${hoursText}`;
  },
});

const createTaskTool = llm.tool({
  description: "Create an autonomous outbound call task to call a business or phone number.",
  parameters: z.object({
    phone: z.string().describe("E.164 formatted phone number to call"),
    entity_name: z.string().describe("Name of the business or person being called"),
    instruction: z.string().describe("Exact question or instruction for the call"),
  }),
  execute: async ({ phone, entity_name, instruction }, { ctx }) => {
    console.log(`[livekit/tool] create_task entity="${entity_name}" phone="${phone}"`);
    const resolvedPhone = normalizePhone(phone);
    if (!resolvedPhone) {
      return `Error: "${phone}" is not a valid phone number.`;
    }

    // Resolve user from session context or room metadata
    const user = (ctx as any)?.userData;
    const userId = user?.id;

    if (!userId) {
      return "Could not identify the registered user for this session.";
    }

    const episode = await createEpisode(userId, undefined, "livekit_voice", user.phoneNumbers?.[0]);
    const task = await createTask(episode.id, "outbound_call", {
      phone: resolvedPhone,
      entityName: entity_name,
      instruction,
    });

    return `Task ${task.id.slice(0, 8)} created. I will call ${entity_name} now and notify you with the result.`;
  },
});

/**
 * Main LiveKit Voice Agent Definition
 */
export default defineAgent({
  entry: async (ctx) => {
    console.log(`[livekit] Agent worker connecting to room ${ctx.room.name}...`);
    await ctx.connect();

    // 1. Wait for caller/participant
    const participant = await ctx.waitForParticipant();
    console.log(`[livekit] Participant connected: ${participant.identity}`);

    // 2. Identify user from SIP caller metadata or phone identity
    const rawCallerId = participant.identity || participant.name || "";
    const user = await findUserByPhone(rawCallerId);
    console.log(`[livekit] Caller ID: "${rawCallerId}" → User: ${user?.name ?? "Unknown"}`);

    const personalizedGreeting = greetingForUser(user);

    // 3. Assemble Voice Pipeline Agent
    const agent = new voice.Agent({
      instructions: `${ALFRED_SYSTEM_PROMPT}\n\nThe caller's name is ${user?.name ?? "there"}.`,
      vad: await silero.VAD.load(),
      stt: new deepgram.STT(),
      llm: new openai.LLM({
        model: "gpt-4o-mini",
        temperature: 0.6,
      }),
      tts: new elevenlabs.TTS({
        voice: "George",
        model: "eleven_flash_v2",
      }),
      tools: {
        getWeather: weatherTool,
        lookupBusiness: lookupBusinessTool,
        createTask: createTaskTool,
      },
    });

    // 4. Start agent session inside the room
    const session = agent.start(ctx.room, participant);

    // 5. Speak initial greeting
    await session.say(personalizedGreeting);
  },
});

// Run with LiveKit CLI runner if invoked directly
if (import.meta.main) {
  cli.runApp(new WorkerOptions({ agent: fileURLToPath(import.meta.url) }));
}
