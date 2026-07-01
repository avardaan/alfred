import { eq } from "drizzle-orm";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { config, requireElevenLabsApiKey } from "../config.ts";
import { db } from "../db/client.ts";
import { users } from "../db/schema.ts";
import { getTask, updateTaskStatus } from "../db/tasks.ts";
import { placeNotificationCall } from "../elevenlabs/outbound-call.ts";

/**
 * Post-call webhook handler. Receives HMAC-signed post_call_transcription events
 * from ElevenLabs when any conversation ends. For outbound worker calls, captures
 * the transcript summary as the task result and notifies the user.
 */
export async function handlePostCallWebhook(req: Request): Promise<Response> {
  const secret = config.postCallWebhookSecret;
  if (!secret) {
    console.error("[post-call] ELEVENLABS_POST_CALL_WEBHOOK_SECRET not set");
    return Response.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  // HMAC verification — this is the correct use of constructEvent (workspace webhooks)
  const rawBody = await req.text();
  const sigHeader = req.headers.get("elevenlabs-signature");
  if (!sigHeader) {
    console.error("[post-call] missing elevenlabs-signature header");
    return Response.json({ error: "Missing signature" }, { status: 401 });
  }

  const client = new ElevenLabsClient({ apiKey: requireElevenLabsApiKey() });

  let event: any;
  try {
    event = await client.webhooks.constructEvent(rawBody, sigHeader, secret);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[post-call] signature verification failed: ${msg}`);
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Only process transcript events
  if (event.type !== "post_call_transcription") {
    return Response.json({ received: true });
  }

  const data = event.data;
  const agentId = data?.agent_id;
  const conversationId = data?.conversation_id;
  const status = data?.status;
  const summary = data?.analysis?.transcript_summary ?? "";
  const dynamicVars = data?.conversation_initiation_client_data?.dynamic_variables ?? {};
  const taskId = dynamicVars.task_id;

  console.log(
    `[post-call] conv=${conversationId} agent=${agentId} status=${status} task=${taskId ?? "none"} summary=${summary.slice(0, 80)}`,
  );

  // Only process outbound worker calls that have a task_id
  if (!taskId || agentId !== config.elevenLabsOutboundAgentId) {
    return Response.json({ received: true });
  }

  const task = await getTask(taskId);
  if (!task) {
    console.error(`[post-call] task ${taskId} not found`);
    return Response.json({ received: true });
  }

  // If task already resolved (submit_task_result fired first), skip
  if (task.status === "completed" || task.status === "failed") {
    console.log(`[post-call] task ${taskId} already ${task.status}, skipping`);
    return Response.json({ received: true });
  }

  // Mark the task based on the conversation outcome
  const success = status === "done" && summary.length > 0;
  const result = summary || (status === "done" ? "Call completed but no summary available." : "Call did not complete successfully.");

  await updateTaskStatus(taskId, success ? "completed" : "failed", {
    outcome: { result },
  });

  console.log(`[post-call] task ${taskId} marked ${success ? "completed" : "failed"}`);

  // Notify the user
  const details = task.details as { phone: string; entityName: string; instruction: string };
  const message = success
    ? `Hi, I called ${details.entityName}. Here's what happened: ${result}.`
    : `Hi, I tried calling ${details.entityName} but couldn't complete the task. ${result}`;

  const userRows = await db.select().from(users).where(eq(users.id, task.userId)).limit(1);
  const userPhone = userRows[0]?.phoneNumbers[0];

  if (userPhone) {
    try {
      await placeNotificationCall({ phoneNumber: userPhone, message });
    } catch (error) {
      console.error(`[post-call] notification call failed:`, error);
    }
  } else {
    console.error(`[post-call] no phone number found for user ${task.userId}`);
  }

  return Response.json({ received: true });
}
