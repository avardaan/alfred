import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { config, requireElevenLabsApiKey } from "../config.ts";
import { getEpisodeByTaskId, updateEpisodeStatus } from "../db/episodes.ts";
import { getTask, updateTaskStatus } from "../db/tasks.ts";
import { notifyUser } from "../notifications.ts";

/**
 * Clean up a transcript summary for spoken notification.
 * Removes references to "AI agent/assistant" and rephrases to first person
 * so Alfred speaks as one entity, not describing another agent's actions.
 */
function cleanResultForSpeech(text: string): string {
  return text
    .replace(/The AI agent,? ?(?:acting|calling|representing)?[^.]*?on behalf of[^.]*?,? ?/gi, "I ")
    .replace(/The AI agent,? /gi, "I ")
    .replace(/An AI agent,? /gi, "I ")
    .replace(/The agent,? /gi, "I ")
    .replace(/an AI assistant,? /gi, "I ")
    .replace(/AI assistant/gi, "I")
    .replace(/\bI I\b/g, "I")
    .trim();
}

/**
 * Post-call webhook handler. Receives HMAC-signed post_call_transcription events
 * from ElevenLabs when any conversation ends.
 *
 * Two call types are handled:
 * - Worker calls (outbound agent): captures the result, marks the task, notifies the user.
 * - Notification calls (inbound agent): marks the episode as completed (user was notified).
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

  // Skip calls without a task_id (regular inbound conversations)
  if (!taskId) {
    return Response.json({ received: true });
  }

  // Notification calls: inbound agent with task_id → user was notified, episode is complete
  if (agentId !== config.elevenLabsOutboundAgentId) {
    console.log(`[post-call] notification call ended for task ${taskId}, marking episode complete`);
    const episode = await getEpisodeByTaskId(taskId);
    if (episode && episode.status !== "completed" && episode.status !== "failed") {
      await updateEpisodeStatus(episode.id, "completed");
      console.log(`[post-call] episode ${episode.id} marked completed`);
    }
    return Response.json({ received: true });
  }

  // Worker calls: outbound agent with task_id → capture result, mark task, notify user
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

  // Notify the user (tracked as a notification call_attempt)
  const details = task.details as { phone: string; entityName: string; instruction: string };
  const message = success
    ? `Hi, I called ${details.entityName}. ${cleanResultForSpeech(result)}`
    : `Hi, I tried calling ${details.entityName} but couldn't complete the task. ${result}`;

  await notifyUser({ taskId, message });

  return Response.json({ received: true });
}
