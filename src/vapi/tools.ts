import type { Vapi } from "@vapi-ai/server-sdk";

export const ALFRED_TOOLS: Vapi.OpenAiModelToolsItem[] = [
  {
    type: "function",
    function: {
      name: "get_weather",
      description:
        "Get current weather for a city or location. Returns conditions plus both Fahrenheit and Celsius. Call once per location per call.",
      parameters: {
        type: "object",
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
        required: ["location"],
      },
    },
  },
];
