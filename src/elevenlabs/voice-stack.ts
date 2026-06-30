import type { ElevenLabs } from "@elevenlabs/elevenlabs-js";

/**
 * ElevenLabs voice stack — pinned in code so sync:agent matches repo.
 *
 * English-primary agents must use `eleven_flash_v2` (ElevenLabs API + language docs).
 * `eleven_flash_v2_5` is for multilingual agents; English speech stays on v2 even with
 * additional `languagePresets`.
 */

/** LLM — turn-taking, tool calls, reply text. */
export const ALFRED_LLM = "gemini-3.5-flash" satisfies ElevenLabs.Llm;

/** STT — Scribe Realtime transcribes caller audio on the phone stream. */
export const ALFRED_ASR: ElevenLabs.AsrConversationalConfig = {
  provider: "scribe_realtime",
  quality: "high",
  userInputAudioFormat: "pcm_16000",
  keywords: [],
};

/** TTS — model and voice settings; voiceId comes from src/assistant/alfred.ts. */
export const ALFRED_TTS: Omit<ElevenLabs.TtsConversationalConfigInput, "voiceId"> = {
  modelId: "eleven_flash_v2",
  agentOutputAudioFormat: "pcm_16000",
  optimizeStreamingLatency: 3,
  stability: 0.5,
  speed: 1,
  similarityBoost: 0.8,
  textNormalisationType: "system_prompt",
};

/** Turn detection — when the agent stops listening and responds. */
export const ALFRED_TURN: ElevenLabs.TurnConfig = {
  turnTimeout: 7,
  silenceEndCallTimeout: -1,
  turnEagerness: "normal",
  spellingPatience: "auto",
  speculativeTurn: false,
  retranscribeOnTurnTimeout: false,
  turnModel: "turn_v3",
};

/** Call session limits. */
export const ALFRED_CONVERSATION: ElevenLabs.ConversationConfigOutput = {
  textOnly: false,
  maxDurationSeconds: 60,
};
