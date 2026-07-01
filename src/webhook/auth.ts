import { timingSafeEqual } from "node:crypto";
import { config } from "../config.ts";

/**
 * Verifies the `X-Webhook-Secret` header on incoming ElevenLabs webhook requests.
 * Hard-fail: returns false if the header is missing, the secret is unset, or they
 * don't match. There is no dev escape hatch — every endpoint that calls this must
 * return 401 when it returns false.
 */
export function verifyWebhookSecret(req: Request): boolean {
  const expected = config.webhookSecret;
  if (!expected) {
    return false;
  }

  const provided = req.headers.get("x-webhook-secret");
  if (!provided) {
    return false;
  }

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);

  if (a.length !== b.length) {
    return false;
  }

  return timingSafeEqual(a, b);
}

/** Standard 401 response for unauthorized webhook requests. */
export function unauthorizedResponse(): Response {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
