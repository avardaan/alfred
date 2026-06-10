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
  ALFRED_PLATFORM_LANGUAGE,
  ALFRED_SPOKEN_LANGUAGE,
  ALFRED_TTS,
  ALFRED_TURN,
} from "./voice-stack.ts";

export function buildConversationInitiationAgentOverride(firstMessage: string) {
  return {
    language: ALFRED_SPOKEN_LANGUAGE,
    firstMessage,
  };
}

export function buildConversationInitiationAgentOverrideWebhook(firstMessage: string) {
  return {
    language: ALFRED_SPOKEN_LANGUAGE,
    first_message: firstMessage,
  };
}

export function buildAlfredConversationConfig(toolId: string): ElevenLabs.ConversationalConfig {
  return {
    asr: ALFRED_ASR,
    turn: ALFRED_TURN,
    tts: {
      ...ALFRED_TTS,
      voiceId: ALFRED_VOICE_ID,
    },
    conversation: ALFRED_CONVERSATION,
    languagePresets: {
      [ALFRED_SPOKEN_LANGUAGE]: {
        overrides: {
          agent: {
            language: ALFRED_SPOKEN_LANGUAGE,
          },
        },
      },
    },
    agent: {
      firstMessage: ALFRED_FIRST_MESSAGE,
      language: ALFRED_PLATFORM_LANGUAGE,
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
