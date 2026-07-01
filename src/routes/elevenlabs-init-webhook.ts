import {
  callerNameVariable,
  findUserByPhone,
  greetingForUser,
} from "../db/users.ts";
import { unauthorizedResponse, verifyWebhookSecret } from "../webhook/auth.ts";

type ElevenLabsInitWebhookBody = {
  caller_id?: string;
  agent_id?: string;
  called_number?: string;
  call_sid?: string;
  conversation_id?: string;
};

export async function handleElevenLabsInitWebhook(req: Request): Promise<Response> {
  if (!verifyWebhookSecret(req)) {
    return unauthorizedResponse();
  }

  let body: ElevenLabsInitWebhookBody;

  try {
    body = (await req.json()) as ElevenLabsInitWebhookBody;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const callerId = body.caller_id?.trim();
  if (!callerId) {
    console.log("[elevenlabs/init] missing caller_id:", body);
    return Response.json(buildInitResponse(undefined, false));
  }

  const user = await findUserByPhone(callerId);
  // Text-initiated channels (WhatsApp, widget) send an empty call_sid and the
  // user's message is already queued — a first_message greeting would be
  // redundant (agent greets, then also replies to the message). Suppress it so
  // the agent just responds to the user's actual text.
  const isVoiceCall = Boolean(body.call_sid);
  console.log(
    `[elevenlabs/init] caller ${callerId} → ${user?.name ?? "unknown"} (${body.call_sid ?? "no sid"}) [${isVoiceCall ? "voice" : "text"}]`,
  );

  return Response.json(buildInitResponse(user, isVoiceCall));
}

function buildInitResponse(
  user: Awaited<ReturnType<typeof findUserByPhone>>,
  includeGreeting: boolean,
) {
  return {
    type: "conversation_initiation_client_data",
    user_id: user?.id,
    dynamic_variables: {
      caller_name: callerNameVariable(user),
    },
    conversation_config_override: {
      agent: {
        // On text channels (WhatsApp, widget) the user's message is already
        // queued — suppress the greeting so the agent responds to it directly.
        first_message: includeGreeting ? greetingForUser(user) : "",
      },
    },
  };
}
