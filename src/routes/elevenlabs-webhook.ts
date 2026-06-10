import { formatTranscriptLines } from "./format-transcript.ts";

type ElevenLabsTranscriptEntry = {
  role?: string;
  message?: string;
};

type ElevenLabsPostCallBody = {
  type?: string;
  event_timestamp?: number;
  data?: {
    agent_id?: string;
    conversation_id?: string;
    status?: string;
    transcript?: ElevenLabsTranscriptEntry[] | string;
    analysis?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  };
};

function formatElevenLabsTranscript(
  transcript: ElevenLabsTranscriptEntry[] | string | undefined,
): string | undefined {
  if (typeof transcript === "string" && transcript.trim()) {
    return transcript.trim();
  }

  if (Array.isArray(transcript)) {
    return formatTranscriptLines(transcript);
  }

  return undefined;
}

export async function handleElevenLabsWebhook(req: Request): Promise<Response> {
  let body: ElevenLabsPostCallBody;

  try {
    body = (await req.json()) as ElevenLabsPostCallBody;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = body.type ?? "unknown";
  const data = body.data;
  const conversationId = data?.conversation_id ?? "unknown";

  console.log(`[elevenlabs] ${eventType} for ${conversationId}`);

  if (eventType === "post_call_transcription") {
    const transcript = formatElevenLabsTranscript(data?.transcript);
    if (transcript) {
      console.log(`[elevenlabs] call transcript (${conversationId}):\n${transcript}`);
    } else {
      console.log(`[elevenlabs] call transcript (${conversationId}): (empty)`);
    }
  } else if (eventType === "call_initiation_failure") {
    console.log(`[elevenlabs] call initiation failure:`, data?.metadata ?? data);
  }

  return Response.json({ received: true });
}
