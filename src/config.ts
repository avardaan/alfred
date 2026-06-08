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
};

export function requireVapiApiKey(): string {
  return required("VAPI_API_KEY");
}
