import { requireWebhookSecret } from "../config.ts";
import { createElevenLabsClient } from "./client.ts";

const WEBHOOK_SECRET_NAME = "alfred_webhook_secret";

/**
 * Ensures the `alfred_webhook_secret` workspace secret exists on ElevenLabs and
 * its value matches the local `WEBHOOK_SECRET` env var. Returns the secret ID
 * (stable across value rotations). Used by setup/sync so the tool + init
 * webhook configs can inject it via `{ secretId }` in requestHeaders.
 */
export async function ensureWebhookSecret(): Promise<string> {
  const value = requireWebhookSecret();
  const client = createElevenLabsClient();

  const page = await client.conversationalAi.secrets.list();
  const existing = page.secrets.find((s) => s.name === WEBHOOK_SECRET_NAME);

  if (existing) {
    await client.conversationalAi.secrets.update(existing.secretId, {
      name: WEBHOOK_SECRET_NAME,
      value,
    });
    console.log(`[secrets] updated workspace secret "${WEBHOOK_SECRET_NAME}" (${existing.secretId})`);
    return existing.secretId;
  }

  const created = await client.conversationalAi.secrets.create({
    name: WEBHOOK_SECRET_NAME,
    value,
  });
  console.log(`[secrets] created workspace secret "${WEBHOOK_SECRET_NAME}" (${created.secretId})`);
  return created.secretId;
}
