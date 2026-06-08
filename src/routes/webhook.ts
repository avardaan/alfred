import { config } from "../config.ts";
import { runTool } from "../tools/index.ts";
import { parseToolCall } from "./parse-tool-call.ts";

type VapiWebhookBody = {
  message?: {
    type?: string;
    status?: string;
    role?: string;
    transcript?: string;
    call?: { id?: string };
    toolCallList?: Array<{
      id: string;
      name?: string;
      parameters?: Record<string, unknown>;
      function?: {
        name?: string;
        arguments?: string | Record<string, unknown>;
      };
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
      const toolCalls = message.toolCallList ?? [];
      const results = await Promise.all(
        toolCalls.map(async (rawToolCall) => {
          try {
            const toolCall = parseToolCall(rawToolCall);
            console.log(`[vapi] tool-calls: ${toolCall.name}`, toolCall.parameters);
            const result = await runTool(toolCall.name, toolCall.parameters);
            return {
              name: toolCall.name,
              toolCallId: toolCall.id,
              result,
            };
          } catch (error) {
            const detail = error instanceof Error ? error.message : "Unknown error";
            const name = rawToolCall.function?.name ?? rawToolCall.name ?? "unknown";
            return {
              name,
              toolCallId: rawToolCall.id,
              error: `Failed to run ${name}: ${detail}`,
            };
          }
        }),
      );

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
