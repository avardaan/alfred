import type { ElevenLabs } from "@elevenlabs/elevenlabs-js";

/** Security override permissions — keep in sync with Alfred dashboard defaults. */
export const ALFRED_OVERRIDE_PERMISSIONS: ElevenLabs.ConversationInitiationClientDataConfigInput =
  {
    enableConversationInitiationClientDataFromWebhook: true,
    customLlmExtraBody: false,
    enableStartingWorkflowNodeIdFromClient: false,
    conversationConfigOverride: {
      asr: { keywords: false },
      turn: { softTimeoutConfig: { message: false } },
      tts: {
        voiceId: false,
        stability: false,
        speed: false,
        similarityBoost: false,
      },
      conversation: { textOnly: true },
      agent: {
        firstMessage: true,
        language: false,
        maxConversationDurationMessage: false,
        prompt: {
          prompt: false,
          llm: false,
          toolIds: false,
          nativeMcpServerIds: false,
          knowledgeBase: false,
        },
      },
    },
  };
