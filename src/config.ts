function optional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function required(name: string): string {
  const value = optional(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT) || 3000,
  vapiApiKey: optional("VAPI_API_KEY"),
  vapiServerUrl: optional("VAPI_SERVER_URL"),
  vapiAssistantId: optional("VAPI_ASSISTANT_ID"),
  vapiPhoneNumberId: optional("VAPI_PHONE_NUMBER_ID"),
  vapiAreaCode: optional("VAPI_AREA_CODE") ?? "415",
  vapiTestPhoneNumber: optional("VAPI_TEST_PHONE_NUMBER"),
  elevenLabsApiKey: optional("ELEVENLABS_API_KEY"),
  elevenLabsServerUrl: optional("ELEVENLABS_SERVER_URL"),
  elevenLabsAgentId: optional("ELEVENLABS_AGENT_ID"),
  elevenLabsPhoneNumberId: optional("ELEVENLABS_PHONE_NUMBER_ID"),
  elevenLabsWeatherToolId: optional("ELEVENLABS_WEATHER_TOOL_ID"),
  twilioAccountSid: optional("TWILIO_ACCOUNT_SID"),
  twilioAuthToken: optional("TWILIO_AUTH_TOKEN"),
  twilioPhoneNumber: optional("TWILIO_PHONE_NUMBER"),
};

export function requireVapiApiKey(): string {
  return required("VAPI_API_KEY");
}

export function requireElevenLabsApiKey(): string {
  return required("ELEVENLABS_API_KEY");
}

export function requireElevenLabsServerUrl(): string {
  return required("ELEVENLABS_SERVER_URL");
}
