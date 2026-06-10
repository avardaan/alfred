import type { ElevenLabs } from "@elevenlabs/elevenlabs-js";
import {
  ALFRED_CALLER_NAME_VARIABLE,
  ALFRED_FIRST_MESSAGE,
  ALFRED_SYSTEM_PROMPT,
  ALFRED_VOICE_ID,
} from "../assistant/alfred.ts";
import {
  ALFRED_ASR,
  ALFRED_CONVERSATION,
  ALFRED_LLM,
  ALFRED_TTS,
  ALFRED_TURN,
} from "./voice-stack.ts";

export function buildAlfredConversationConfig(toolId: string): ElevenLabs.ConversationalConfig {
  return {
    asr: ALFRED_ASR,
    turn: ALFRED_TURN,
    tts: {
      ...ALFRED_TTS,
      voiceId: ALFRED_VOICE_ID,
    },
    conversation: ALFRED_CONVERSATION,
    agent: {
      firstMessage: ALFRED_FIRST_MESSAGE,
      language: "en",
      disableFirstMessageInterruptions: true,
      dynamicVariables: {
        dynamicVariablePlaceholders: {
          [ALFRED_CALLER_NAME_VARIABLE]: "there",
        },
      },
      prompt: {
        prompt: ALFRED_SYSTEM_PROMPT,
        llm: ALFRED_LLM,
        toolIds: [toolId],
      },
    },
  };
}

export function buildAlfredAgentRequest(toolId: string, serverUrl: string) {
  const baseUrl = serverUrl.replace(/\/$/, "");

  return {
    name: "Alfred",
    conversationConfig: buildAlfredConversationConfig(toolId),
    platformSettings: {
      overrides: {
        enableConversationInitiationClientDataFromWebhook: true,
        conversationConfigOverride: {
          agent: {
            firstMessage: true,
          },
        },
      },
      workspaceOverrides: {
        conversationInitiationClientDataWebhook: {
          url: `${baseUrl}/webhook/elevenlabs/init`,
          requestHeaders: {},
        },
      },
    },
  };
}
