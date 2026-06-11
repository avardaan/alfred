import {
  callerNameVariable,
  findUserByPhone,
  greetingForUser,
} from "../db/users.ts";

type ElevenLabsInitWebhookBody = {
  caller_id?: string;
  agent_id?: string;
  called_number?: string;
  call_sid?: string;
};

export async function handleElevenLabsInitWebhook(req: Request): Promise<Response> {
  let body: ElevenLabsInitWebhookBody;

  try {
    body = (await req.json()) as ElevenLabsInitWebhookBody;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const callerId = body.caller_id?.trim();
  if (!callerId) {
    console.log("[elevenlabs/init] missing caller_id:", body);
    return Response.json(buildInitResponse(undefined));
  }

  const user = findUserByPhone(callerId);
  console.log(
    `[elevenlabs/init] caller ${callerId} → ${user?.name ?? "unknown"} (${body.call_sid ?? "no sid"})`,
  );

  return Response.json(buildInitResponse(user));
}

function buildInitResponse(user: ReturnType<typeof findUserByPhone>) {
  return {
    type: "conversation_initiation_client_data",
    user_id: user?.id,
    dynamic_variables: {
      caller_name: callerNameVariable(user),
    },
    conversation_config_override: {
      agent: {
        first_message: greetingForUser(user),
      },
    },
  };
}
