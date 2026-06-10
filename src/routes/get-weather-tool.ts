import { runTool } from "../tools/index.ts";

type ElevenLabsToolWebhookBody = {
  tool_call_id?: string;
  tool_name?: string;
  parameters?: Record<string, unknown>;
  conversation_id?: string;
  location?: unknown;
  unit?: unknown;
};

function extractToolParameters(
  body: ElevenLabsToolWebhookBody,
): Record<string, unknown> {
  if (body.parameters && typeof body.parameters === "object") {
    return body.parameters;
  }

  const parameters: Record<string, unknown> = {};
  if (body.location !== undefined) {
    parameters.location = body.location;
  }
  if (body.unit !== undefined) {
    parameters.unit = body.unit;
  }
  return parameters;
}

export async function handleGetWeatherTool(req: Request): Promise<Response> {
  let body: ElevenLabsToolWebhookBody;

  try {
    body = (await req.json()) as ElevenLabsToolWebhookBody;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const toolName = body.tool_name ?? "get_weather";
  const parameters = extractToolParameters(body);

  try {
    console.log(
      `[elevenlabs] tool ${toolName} (conversation ${body.conversation_id ?? "unknown"}):`,
      parameters,
    );
    const result = await runTool(toolName, parameters);
    return Response.json({ result });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    console.error(`[elevenlabs] tool ${toolName} failed:`, detail);
    return Response.json({ result: `Failed to run ${toolName}: ${detail}` });
  }
}
