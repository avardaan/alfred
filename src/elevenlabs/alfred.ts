import type { ElevenLabs } from "@elevenlabs/elevenlabs-js";
import {
  ALFRED_FIRST_MESSAGE,
  ALFRED_SYSTEM_PROMPT,
  ALFRED_VOICE_ID,
} from "../assistant/alfred.ts";

export function buildAlfredConversationConfig(toolId: string): ElevenLabs.ConversationalConfig {
  return {
    agent: {
      firstMessage: ALFRED_FIRST_MESSAGE,
      language: "en",
      disableFirstMessageInterruptions: true,
      prompt: {
        prompt: ALFRED_SYSTEM_PROMPT,
        llm: "gpt-4o",
        toolIds: [toolId],
      },
    },
    tts: {
      voiceId: ALFRED_VOICE_ID,
    },
  };
}

export function buildAlfredAgentRequest(toolId: string) {
  return {
    name: "Alfred",
    conversationConfig: buildAlfredConversationConfig(toolId),
  };
}
