import type { ElevenLabs } from "@elevenlabs/elevenlabs-js";
import {
  ALFRED_OUTBOUND_FIRST_MESSAGE,
  ALFRED_OUTBOUND_SYSTEM_PROMPT,
  ALFRED_OUTBOUND_VOICE_ID,
} from "../assistant/alfred-outbound.ts";
import { ALFRED_ASR, ALFRED_LLM, ALFRED_TTS } from "./voice-stack.ts";
import { ALFRED_OVERRIDE_PERMISSIONS } from "./overrides.ts";

const ALFRED_OUTBOUND_TURN: ElevenLabs.TurnConfig = {
  turnTimeout: 15,
  silenceEndCallTimeout: -1,
  turnEagerness: "normal",
  spellingPatience: "auto",
  speculativeTurn: false,
  retranscribeOnTurnTimeout: false,
  turnModel: "turn_v3",
};

const ALFRED_OUTBOUND_CONVERSATION: ElevenLabs.ConversationConfigOutput = {
  textOnly: false,
  maxDurationSeconds: 120,
};

export function buildAlfredOutboundConversationConfig(
  submitResultToolId: string,
): ElevenLabs.ConversationalConfig {
  return {
    asr: ALFRED_ASR,
    turn: ALFRED_OUTBOUND_TURN,
    tts: {
      ...ALFRED_TTS,
      voiceId: ALFRED_OUTBOUND_VOICE_ID,
    },
    conversation: ALFRED_OUTBOUND_CONVERSATION,
    agent: {
      firstMessage: ALFRED_OUTBOUND_FIRST_MESSAGE,
      language: "en",
      dynamicVariables: {
        dynamicVariablePlaceholders: {
          task_instruction: "Could you tell me your business hours?",
        },
      },
      prompt: {
        prompt: ALFRED_OUTBOUND_SYSTEM_PROMPT,
        llm: ALFRED_LLM,
        toolIds: [submitResultToolId],
      },
    },
  };
}

export function buildAlfredOutboundAgentRequest(submitResultToolId: string) {
  return {
    name: "alfred-worker",
    conversationConfig: buildAlfredOutboundConversationConfig(submitResultToolId),
    platformSettings: {
      overrides: ALFRED_OVERRIDE_PERMISSIONS,
    },
  };
}
