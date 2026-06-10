import { runTool } from "../tools/index.ts";

type ElevenLabsToolWebhookBody = {
  tool_call_id?: string;
  tool_name?: string;
  parameters?: Record<string, unknown>;
  conversation_id?: string;
};

export async function handleGetWeatherTool(req: Request): Promise<Response> {
  let body: ElevenLabsToolWebhookBody;

  try {
    body = (await req.json()) as ElevenLabsToolWebhookBody;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const toolName = body.tool_name ?? "get_weather";
  const parameters = body.parameters ?? {};

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
