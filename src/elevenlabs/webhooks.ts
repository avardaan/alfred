import { createElevenLabsClient } from "./client.ts";

export const POST_CALL_WEBHOOK_NAME = "alfred render server";

const POST_CALL_WEBHOOK_EVENTS = ["transcript"] as const;

export function buildPostCallWebhookUrl(serverUrl: string): string {
  return `${serverUrl.replace(/\/$/, "")}/webhook/elevenlabs`;
}

export async function ensurePostCallWebhook(serverUrl: string): Promise<string> {
  const client = createElevenLabsClient();
  const targetUrl = buildPostCallWebhookUrl(serverUrl);
  const { webhooks } = await client.webhooks.list();

  const exactMatch = webhooks.find((webhook) => webhook.webhookUrl === targetUrl);
  const webhookId =
    exactMatch?.webhookId ??
    (
      await client.webhooks.create({
        settings: {
          authType: "hmac",
          name: POST_CALL_WEBHOOK_NAME,
          webhookUrl: targetUrl,
        },
      })
    ).webhookId;

  await client.conversationalAi.settings.update({
    webhooks: {
      postCallWebhookId: webhookId,
      events: [...POST_CALL_WEBHOOK_EVENTS],
      transcriptFormat: "json",
    },
  });

  for (const webhook of webhooks) {
    if (webhook.webhookId === webhookId) {
      continue;
    }

    const staleAlfredWebhook =
      webhook.name === POST_CALL_WEBHOOK_NAME || webhook.webhookUrl.endsWith("/webhook/elevenlabs");

    if (staleAlfredWebhook) {
      await client.webhooks.delete(webhook.webhookId);
    }
  }

  return webhookId;
}
