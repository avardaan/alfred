import { getWeather, parseTemperatureUnit } from "./weather.ts";

export type ToolCall = {
  id: string;
  name: string;
  parameters?: Record<string, unknown>;
};

export async function runTool(
  name: string,
  parameters: Record<string, unknown> = {},
): Promise<string> {
  switch (name) {
    case "get_weather": {
      const location =
        typeof parameters.location === "string" ? parameters.location : "";
      const unit = parseTemperatureUnit(parameters.unit);
      return getWeather(location, unit);
    }

    default:
      return `Tool "${name}" is not implemented yet.`;
  }
}
