import { config } from "../config.ts";

type VapiWebhookBody = {
  message?: {
    type?: string;
    status?: string;
    role?: string;
    transcript?: string;
    call?: { id?: string };
    toolCallList?: Array<{
      id: string;
      name: string;
      parameters?: Record<string, unknown>;
    }>;
  };
};

export async function handleVapiWebhook(req: Request): Promise<Response> {
  let body: VapiWebhookBody;

  try {
    body = (await req.json()) as VapiWebhookBody;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = body.message;
  if (!message?.type) {
    return Response.json({ received: true });
  }

  switch (message.type) {
    case "assistant-request": {
      if (!config.vapiAssistantId) {
        console.warn("assistant-request received but VAPI_ASSISTANT_ID is not set");
        return Response.json(
          { error: "No assistant configured for inbound calls." },
          { status: 500 },
        );
      }

      return Response.json({ assistantId: config.vapiAssistantId });
    }

    case "tool-calls": {
      const results =
        message.toolCallList?.map((toolCall) => ({
          name: toolCall.name,
          toolCallId: toolCall.id,
          result: JSON.stringify({
            error: `Tool "${toolCall.name}" is not implemented yet.`,
          }),
        })) ?? [];

      return Response.json({ results });
    }

    case "status-update":
      console.log(`[vapi] call ${message.call?.id ?? "unknown"}: ${message.status}`);
      break;

    case "transcript":
      console.log(`[vapi] ${message.role}: ${message.transcript}`);
      break;

    case "end-of-call-report":
      console.log(`[vapi] end-of-call-report for ${message.call?.id ?? "unknown"}`);
      break;

    default:
      console.log(`[vapi] ${message.type}`);
  }

  return Response.json({ received: true });
}
