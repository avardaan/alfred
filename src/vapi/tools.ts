import type { Vapi } from "@vapi-ai/server-sdk";

export const ALFRED_TOOLS: Vapi.OpenAiModelToolsItem[] = [
  {
    type: "function",
    function: {
      name: "get_weather",
      description:
        "Get the current weather for a city or location. Use when the caller asks about weather, temperature, or conditions.",
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: 'City or location, e.g. "San Francisco" or "Oakland"',
          },
        },
        required: ["location"],
      },
    },
    messages: [
      {
        type: "request-start",
        content: "One moment while I check the weather.",
      },
    ],
  },
];
