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
  databaseUrl: optional("DATABASE_URL"),
  elevenLabsApiKey: optional("ELEVENLABS_API_KEY"),
  elevenLabsServerUrl: optional("ELEVENLABS_SERVER_URL"),
  elevenLabsAgentId: optional("ELEVENLABS_AGENT_ID"),
  elevenLabsPhoneNumberId: optional("ELEVENLABS_PHONE_NUMBER_ID"),
  elevenLabsWeatherToolId: optional("ELEVENLABS_WEATHER_TOOL_ID"),
  elevenLabsTestPhoneNumber: optional("ELEVENLABS_TEST_PHONE_NUMBER"),
  elevenLabsOutboundAgentId: optional("ELEVENLABS_OUTBOUND_AGENT_ID"),
  elevenLabsSubmitTaskResultToolId: optional("ELEVENLABS_SUBMIT_TASK_RESULT_TOOL_ID"),
  elevenLabsCreateTaskToolId: optional("ELEVENLABS_CREATE_TASK_TOOL_ID"),
  elevenLabsLookupBusinessToolId: optional("ELEVENLABS_LOOKUP_BUSINESS_TOOL_ID"),
  googlePlacesApiKey: optional("GOOGLE_PLACES_API_KEY"),
  twilioAccountSid: optional("TWILIO_ACCOUNT_SID"),
  twilioAuthToken: optional("TWILIO_AUTH_TOKEN"),
  twilioPhoneNumber: optional("TWILIO_PHONE_NUMBER"),
};

export function requireElevenLabsApiKey(): string {
  return required("ELEVENLABS_API_KEY");
}

export function requireElevenLabsServerUrl(): string {
  return required("ELEVENLABS_SERVER_URL");
}

export function requireDatabaseUrl(): string {
  return required("DATABASE_URL");
}
