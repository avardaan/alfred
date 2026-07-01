import type { ElevenLabs } from "@elevenlabs/elevenlabs-js";
import {
  ALFRED_CALLER_NAME_VARIABLE,
  ALFRED_FIRST_MESSAGE,
  ALFRED_HINDI_FIRST_MESSAGE,
  ALFRED_HINDI_SYSTEM_PROMPT,
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
import { ALFRED_OVERRIDE_PERMISSIONS } from "./overrides.ts";

export function buildAlfredConversationConfig(toolIds: string[]): ElevenLabs.ConversationalConfig {
  return {
    asr: ALFRED_ASR,
    turn: ALFRED_TURN,
    tts: {
      ...ALFRED_TTS,
      voiceId: ALFRED_VOICE_ID,
    },
    conversation: ALFRED_CONVERSATION,
    languagePresets: {
      hi: {
        overrides: {
          agent: {
            language: "hi",
            firstMessage: ALFRED_HINDI_FIRST_MESSAGE,
            prompt: {
              prompt: ALFRED_HINDI_SYSTEM_PROMPT,
            },
          },
        },
      },
    },
    agent: {
      firstMessage: ALFRED_FIRST_MESSAGE,
      language: "en",
      disableFirstMessageInterruptions: true,
      dynamicVariables: {
        dynamicVariablePlaceholders: {
          [ALFRED_CALLER_NAME_VARIABLE]: "there",
          notification_message: "",
        },
      },
      prompt: {
        prompt: ALFRED_SYSTEM_PROMPT,
        llm: ALFRED_LLM,
        toolIds: toolIds,
        builtInTools: {
          languageDetection: {
            name: "language_detection",
            params: {
              systemToolType: "language_detection",
            },
          },
          voicemailDetection: {
            name: "voicemail_detection",
            params: {
              systemToolType: "voicemail_detection",
              voicemailMessage: "{{notification_message}}",
            },
          },
        },
      },
    },
  };
}

export function buildAlfredAgentRequest(
  toolIds: string[],
  serverUrl: string,
  webhookSecretId: string,
) {
  const baseUrl = serverUrl.replace(/\/$/, "");

  return {
    name: "alfred-client",
    conversationConfig: buildAlfredConversationConfig(toolIds),
    platformSettings: {
      overrides: ALFRED_OVERRIDE_PERMISSIONS,
      workspaceOverrides: {
        conversationInitiationClientDataWebhook: {
          url: `${baseUrl}/webhook/elevenlabs/init`,
          requestHeaders: {
            "X-Webhook-Secret": { secretId: webhookSecretId },
          },
        },
      },
    },
  };
}
