import type { ElevenLabs } from "@elevenlabs/elevenlabs-js";
import { createElevenLabsClient } from "./client.ts";

export const GET_WEATHER_TOOL_NAME = "get_weather";

export function buildGetWeatherToolConfig(serverUrl: string): ElevenLabs.WebhookToolConfigInput {
  const baseUrl = serverUrl.replace(/\/$/, "");

  return {
    name: GET_WEATHER_TOOL_NAME,
    description:
      "Get current weather for a city or location. Returns conditions plus both Fahrenheit and Celsius. Call once per location per call.",
    responseTimeoutSecs: 20,
    apiSchema: {
      url: `${baseUrl}/tools/get_weather`,
      method: "POST",
      requestBodySchema: {
        type: "object",
        required: ["location"],
        properties: {
          location: {
            type: "string",
            description: 'City or location, e.g. "San Francisco" or "Oakland"',
          },
          unit: {
            type: "string",
            enum: ["fahrenheit", "celsius"],
            description:
              'Temperature unit. Default fahrenheit. Use celsius when the caller asks for Celsius, centigrade, or metric.',
          },
        },
      },
    },
  };
}

export async function ensureGetWeatherTool(serverUrl: string, toolId?: string): Promise<string> {
  const client = createElevenLabsClient();
  const toolConfig: ElevenLabs.ToolRequestModelToolConfig = {
    type: "webhook",
    ...buildGetWeatherToolConfig(serverUrl),
  };

  if (toolId) {
    await client.conversationalAi.tools.update(toolId, { toolConfig });
    return toolId;
  }

  const page = await client.conversationalAi.tools.list({
    search: GET_WEATHER_TOOL_NAME,
    types: ["webhook"],
    pageSize: 20,
  });

  const match = page.tools.find(
    (tool) => tool.toolConfig.type === "webhook" && tool.toolConfig.name === GET_WEATHER_TOOL_NAME,
  );
  if (match) {
    await client.conversationalAi.tools.update(match.id, { toolConfig });
    return match.id;
  }

  const created = await client.conversationalAi.tools.create({ toolConfig });
  return created.id;
}
