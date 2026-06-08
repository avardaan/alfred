type RawToolCall = {
  id: string;
  name?: string;
  parameters?: Record<string, unknown>;
  function?: {
    name?: string;
    arguments?: string | Record<string, unknown>;
  };
};

function parseArguments(value: unknown): Record<string, unknown> {
  if (value == null) {
    return {};
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return {};
    }

    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  }

  throw new Error("Invalid tool arguments.");
}

export type ParsedToolCall = {
  id: string;
  name: string;
  parameters: Record<string, unknown>;
};

export function parseToolCall(toolCall: RawToolCall): ParsedToolCall {
  const name = toolCall.function?.name ?? toolCall.name;
  if (!name) {
    throw new Error("Tool call is missing a function name.");
  }

  let parameters = toolCall.parameters ?? {};

  if (toolCall.function?.arguments !== undefined) {
    try {
      parameters = parseArguments(toolCall.function.arguments);
    } catch {
      throw new Error(`Invalid tool arguments for ${name}.`);
    }
  }

  return { id: toolCall.id, name, parameters };
}
