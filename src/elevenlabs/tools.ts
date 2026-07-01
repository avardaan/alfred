import type { ElevenLabs } from "@elevenlabs/elevenlabs-js";
import { createElevenLabsClient } from "./client.ts";

export const GET_WEATHER_TOOL_NAME = "get_weather";
export const SUBMIT_TASK_RESULT_TOOL_NAME = "submit_task_result";
export const CREATE_TASK_TOOL_NAME = "create_task";
export const LOOKUP_BUSINESS_TOOL_NAME = "lookup_business";

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

export function buildSubmitTaskResultToolConfig(
  serverUrl: string,
): ElevenLabs.WebhookToolConfigInput {
  const baseUrl = serverUrl.replace(/\/$/, "");

  return {
    name: SUBMIT_TASK_RESULT_TOOL_NAME,
    description:
      "Submit the result of an outbound task. Call this with the business hours once obtained, or with success=false if you could not reach anyone.",
    responseTimeoutSecs: 15,
    apiSchema: {
      url: `${baseUrl}/tools/submit_task_result`,
      method: "POST",
      requestBodySchema: {
        type: "object",
        required: ["task_id", "success"],
        properties: {
          task_id: {
            type: "string",
            description: "The task ID provided as a dynamic variable.",
          },
          hours: {
            type: "string",
            description: "The business hours as a plain text summary.",
          },
          success: {
            type: "boolean",
            description: "Whether the call was successful in getting the hours.",
          },
        },
      },
    },
  };
}

export function buildCreateTaskToolConfig(
  serverUrl: string,
): ElevenLabs.WebhookToolConfigInput {
  const baseUrl = serverUrl.replace(/\/$/, "");

  return {
    name: CREATE_TASK_TOOL_NAME,
    description:
      "Create a task for Alfred to place an outbound call. Requires a phone number and a label for who is being called. Alfred will call and report back. Use lookup_business first if you need to find a business phone number.",
    responseTimeoutSecs: 20,
    apiSchema: {
      url: `${baseUrl}/tools/create_task`,
      method: "POST",
      requestBodySchema: {
        type: "object",
        required: ["phone", "business_name"],
        properties: {
          phone: {
            type: "string",
            description: "The phone number to call in E.164 format, e.g. +15105551234.",
          },
          business_name: {
            type: "string",
            description: "A label for who is being called — a business name or a person's name.",
          },
        },
      },
    },
  };
}

export function buildLookupBusinessToolConfig(
  serverUrl: string,
): ElevenLabs.WebhookToolConfigInput {
  const baseUrl = serverUrl.replace(/\/$/, "");

  return {
    name: LOOKUP_BUSINESS_TOOL_NAME,
    description:
      "Look up a business by name to get its phone number and address. Returns the top match. Use this before create_task when the user doesn't already have a phone number, so you can read back the name and address for confirmation.",
    responseTimeoutSecs: 15,
    apiSchema: {
      url: `${baseUrl}/tools/lookup_business`,
      method: "POST",
      requestBodySchema: {
        type: "object",
        required: ["business_name"],
        properties: {
          business_name: {
            type: "string",
            description: "The name of the business to look up.",
          },
          location: {
            type: "string",
            description: "City or area to search in, e.g. 'San Francisco'. Optional — if omitted, uses the user's primary location.",
          },
        },
      },
    },
  };
}

async function ensureWebhookTool(
  toolConfig: ElevenLabs.ToolRequestModelToolConfig,
  toolName: string,
  toolId?: string,
): Promise<string> {
  const client = createElevenLabsClient();

  if (toolId) {
    await client.conversationalAi.tools.update(toolId, { toolConfig });
    return toolId;
  }

  const page = await client.conversationalAi.tools.list({
    search: toolName,
    types: ["webhook"],
    pageSize: 20,
  });

  const match = page.tools.find(
    (tool) => tool.toolConfig.type === "webhook" && tool.toolConfig.name === toolName,
  );
  if (match) {
    await client.conversationalAi.tools.update(match.id, { toolConfig });
    return match.id;
  }

  const created = await client.conversationalAi.tools.create({ toolConfig });
  return created.id;
}

export async function ensureGetWeatherTool(serverUrl: string, toolId?: string): Promise<string> {
  const toolConfig: ElevenLabs.ToolRequestModelToolConfig = {
    type: "webhook",
    ...buildGetWeatherToolConfig(serverUrl),
  };
  return ensureWebhookTool(toolConfig, GET_WEATHER_TOOL_NAME, toolId);
}

export async function ensureSubmitTaskResultTool(
  serverUrl: string,
  toolId?: string,
): Promise<string> {
  const toolConfig: ElevenLabs.ToolRequestModelToolConfig = {
    type: "webhook",
    ...buildSubmitTaskResultToolConfig(serverUrl),
  };
  return ensureWebhookTool(toolConfig, SUBMIT_TASK_RESULT_TOOL_NAME, toolId);
}

export async function ensureCreateTaskTool(serverUrl: string, toolId?: string): Promise<string> {
  const toolConfig: ElevenLabs.ToolRequestModelToolConfig = {
    type: "webhook",
    ...buildCreateTaskToolConfig(serverUrl),
  };
  return ensureWebhookTool(toolConfig, CREATE_TASK_TOOL_NAME, toolId);
}

export async function ensureLookupBusinessTool(serverUrl: string, toolId?: string): Promise<string> {
  const toolConfig: ElevenLabs.ToolRequestModelToolConfig = {
    type: "webhook",
    ...buildLookupBusinessToolConfig(serverUrl),
  };
  return ensureWebhookTool(toolConfig, LOOKUP_BUSINESS_TOOL_NAME, toolId);
}
