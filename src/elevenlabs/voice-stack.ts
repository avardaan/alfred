import type { ElevenLabs } from "@elevenlabs/elevenlabs-js";

/**
 * ElevenLabs voice stack — pinned in code so sync:agent matches repo.
 *
 * Alfred speaks English. ElevenLabs only allows `eleven_flash_v2_5` when
 * `agent.language` is not `en`, so we set a non-English platform language and
 * pin spoken English via `languagePresets` + per-call overrides.
 */

/** Language Alfred speaks on calls. */
export const ALFRED_SPOKEN_LANGUAGE = "en";

/** Agent default language in ElevenLabs — must not be `en` to use flash v2.5. */
export const ALFRED_PLATFORM_LANGUAGE = "fr";

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
  modelId: "eleven_flash_v2_5",
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
  maxDurationSeconds: 600,
};
