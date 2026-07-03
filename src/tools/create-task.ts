import { normalizePhone } from "../db/users.ts";
import { createEpisode } from "../db/episodes.ts";
import {
  createAttempt,
  createTask,
  getTask,
  updateAttempt,
  updateTaskStatus,
  type TaskDetails,
} from "../db/tasks.ts";
import { createElevenLabsClient } from "../elevenlabs/client.ts";
import { placeOutboundCall } from "../elevenlabs/outbound-call.ts";
import { notifyUser } from "../notifications.ts";
import { config } from "../config.ts";
import { unauthorizedResponse, verifyWebhookSecret } from "../webhook/auth.ts";

type CreateTaskBody = {
  phone?: string;
  entity_name?: string;
  instruction?: string;
  conversation_id?: string;
};

const RETRY_DELAY_MS = 75 * 1000; // 60s ringing timeout + 15s buffer before checking
const COMPLETION_TIMEOUT_MS = 5 * 60 * 1000; // 5 min final safety net for any stuck state
export const MAX_ATTEMPTS = 2; // initial call + 1 retry

export async function handleCreateTaskTool(req: Request): Promise<Response> {
  if (!verifyWebhookSecret(req)) {
    return unauthorizedResponse();
  }

  let body: CreateTaskBody;

  try {
    body = (await req.json()) as CreateTaskBody;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const phone = body.phone?.trim();
  const entityName = body.entity_name?.trim();
  const instruction = body.instruction?.trim();
  const userId = req.headers.get("x-user-id") ?? undefined;

  console.log(
    `[tools/create_task] phone=${phone ?? "(none)"} entity=${entityName} instruction=${instruction ?? "(none)"} user=${userId ?? "none"}`,
  );

  if (!phone || !entityName || !instruction) {
    return Response.json({
      result: "Error: missing phone, entity_name, or instruction.",
    });
  }

  if (!userId) {
    return Response.json({
      result: "Error: could not identify the user. Please ensure you're a registered user.",
    });
  }

  const resolvedPhone = normalizePhone(phone);

  // Server-side guard: reject obviously fake/placeholder numbers.
  // The agent should never call create_task without a real user-provided number.
  if (!resolvedPhone || !resolvedPhone.startsWith("+")) {
    console.error(`[tools/create_task] invalid phone (not E.164): ${phone}`);
    return Response.json({
      result: `Error: "${phone}" is not a valid phone number. Ask the user for the actual number — do not make one up.`,
    });
  }
  // Reject common placeholder patterns (555 numbers, all same digit, sequential)
  const digits = resolvedPhone.slice(1); // strip +
  const isPlaceholder =
    digits.includes("555") && digits.length >= 10 || // 555-01xx is reserved for fiction
    /^(\d)\1{6,}$/.test(digits) || // all same digit (1111111)
    /^0123456789|1234567890$/.test(digits); // sequential
  if (isPlaceholder) {
    console.error(`[tools/create_task] placeholder phone rejected: ${resolvedPhone}`);
    return Response.json({
      result: `Error: "${resolvedPhone}" looks like a placeholder, not a real number. Ask the user for the actual number.`,
    });
  }

  // Determine originating channel from ElevenLabs system variable headers.
  // For WhatsApp: X-Called-Number is the WhatsApp phone number ID (no + prefix).
  // For voice: X-Called-Number is a phone number (starts with +).
  const callerId = req.headers.get("x-caller-id") ?? undefined;
  const calledNumber = req.headers.get("x-called-number") ?? undefined;
  const whatsappPhoneNumberId = config.elevenLabsWhatsappPhoneNumberId;
  const channel =
    calledNumber && whatsappPhoneNumberId && calledNumber === whatsappPhoneNumberId
      ? "whatsapp"
      : "voice";

  console.log(
    `[tools/create_task] channel=${channel} callerId=${callerId ?? "none"} calledNumber=${calledNumber ?? "none"}`,
  );

  // Create an episode for this user request, then the task under it
  const episode = await createEpisode(userId, body.conversation_id, channel, callerId);
  const task = await createTask(episode.id, "outbound_call", {
    phone: resolvedPhone,
    entityName,
    instruction,
  });

  // Place the outbound call
  let batchCallId: string;
  try {
    const result = await placeOutboundCall({
      phoneNumber: resolvedPhone,
      taskId: task.id,
      instruction,
      attemptNumber: 1,
      maxAttempts: MAX_ATTEMPTS,
    });
    batchCallId = result.batchCallId;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    console.error(`[tools/create_task] outbound call failed:`, detail);
    await updateTaskStatus(task.id, "failed", { outcome: { result: "" } });
    return Response.json({
      result: `I tried to call ${entityName} but something went wrong: ${detail}`,
    });
  }

  // Create a worker call attempt record
  const attempt = await createAttempt(task.id, "worker", {
    elevenlabsBatchCallId: batchCallId,
    attemptNumber: 1,
  });
  await updateAttempt(attempt.id, "in_progress");
  await updateTaskStatus(task.id, "in_progress");

  // Schedule ringing-timeout check (if call never connects/no-answers, retry once)
  setTimeout(
    () => checkAndRetry(task.id, attempt.id, batchCallId, 1),
    RETRY_DELAY_MS,
  );

  // Schedule final timeout (safety net for any stuck state)
  setTimeout(() => checkFinalTimeout(task.id), COMPLETION_TIMEOUT_MS);

  return Response.json({
    result: `I'll call ${entityName} now and report back.`,
  });
}

/**
 * Place a retry worker attempt for a task. Used by:
 *  - checkAndRetry when the previous attempt terminates with no answer
 *    (batch-call recipient status failed/cancelled and no conversation).
 *  - submit_task_result when the agent explicitly requests a retry after
 *    reaching voicemail on a non-final attempt.
 *
 * `nextAttemptNumber` is 1-indexed. The function:
 *  1. Places a fresh outbound call with attempt_number/max_attempts exposed
 *     so the worker agent knows whether to leave a voicemail on this attempt.
 *  2. Creates a worker call_attempt row with that attempt_number.
 *  3. Re-arms the ringing-timeout check.
 *
 * Throws if the outbound call fails — the caller is responsible for
 * fail-and-notify handling.
 */
export async function placeRetryAttempt(
  taskId: string,
  details: TaskDetails,
  nextAttemptNumber: number,
): Promise<void> {
  const result = await placeOutboundCall({
    phoneNumber: details.phone,
    taskId,
    instruction: details.instruction,
    attemptNumber: nextAttemptNumber,
    maxAttempts: MAX_ATTEMPTS,
  });

  const attempt = await createAttempt(taskId, "worker", {
    elevenlabsBatchCallId: result.batchCallId,
    attemptNumber: nextAttemptNumber,
  });
  await updateAttempt(attempt.id, "in_progress");

  console.log(
    `[tools/create_task] retry task ${taskId} → attempt ${nextAttemptNumber}/${MAX_ATTEMPTS} (batch ${result.batchCallId})`,
  );

  setTimeout(
    () => checkAndRetry(taskId, attempt.id, result.batchCallId, nextAttemptNumber),
    RETRY_DELAY_MS,
  );
}

/**
 * Check whether a batch call recipient answered. Branches on the recipient's
 * lifecycle status — NOT on conversation_id — so a slow voicemail pickup is
 * never mistaken for "no answer" (the original duplicate-dial bug):
 *
 *   pending | dispatched | initiated  → still ringing — re-arm the timer.
 *   in_progress | completed | voicemail → call connected (human or voicemail).
 *                                          The worker agent owns this case:
 *                                          it calls submit_task_result (with
 *                                          retry=true if on a non-final attempt
 *                                          and it hit voicemail, or success
 *                                          otherwise). The post-call webhook
 *                                          remains a fallback for completion.
 *   failed | cancelled (no conversation) → genuine no-answer — retry-or-fail.
 */
const RINGING_RECIPIENT_STATUSES = new Set(["pending", "dispatched", "initiated"]);
const CONNECTED_RECIPIENT_STATUSES = new Set(["in_progress", "completed", "voicemail"]);

async function checkAndRetry(
  taskId: string,
  attemptId: string,
  batchCallId: string,
  attemptNumber: number,
): Promise<void> {
  const task = await getTask(taskId);
  if (!task || task.status === "completed" || task.status === "failed") {
    return;
  }

  const details = task.details as TaskDetails;

  try {
    const client = createElevenLabsClient();
    const batchCall = await client.conversationalAi.batchCalls.get(batchCallId);
    const recipient = batchCall.recipients[0];
    const recipientStatus = recipient?.status;
    const conversationId = recipient?.conversationId;

    console.log(
      `[tools/create_task] attempt ${attemptNumber} batch ${batchCallId} recipient_status=${recipientStatus ?? "unknown"} conv=${conversationId ?? "none"}`,
    );

    if (recipientStatus && CONNECTED_RECIPIENT_STATUSES.has(recipientStatus)) {
      // Call connected (human or voicemail). Let the worker agent call
      // submit_task_result — its retry flag drives the next-attempt scheduling.
      // The post-call webhook is the fallback if submit_task_result never fires.
      return;
    }

    if (recipientStatus && RINGING_RECIPIENT_STATUSES.has(recipientStatus)) {
      // Still ringing. Re-arm — voicemail pickup can happen well after the
      // initial ringing timeout used by setTimeout.
      console.log(`[tools/create_task] attempt ${attemptNumber} still ringing, re-arming`);
      setTimeout(
        () => checkAndRetry(taskId, attemptId, batchCallId, attemptNumber),
        RETRY_DELAY_MS,
      );
      return;
    }

    // Terminal no-answer (failed/cancelled/unknown) — mark attempt failed and retry-or-fail.
    const failureReason = `Call ${recipientStatus ?? "terminated"}`;
    await updateAttempt(attemptId, "failed", {
      elevenlabsConversationId: conversationId,
      failureReason,
    });
    await handleNoAnswer(taskId, details, attemptNumber);
  } catch (error) {
    console.error(`[tools/create_task] retry check failed:`, error);
  }
}

/**
 * Either retry the call or fail the task + notify, depending on attempt count.
 */
async function handleNoAnswer(
  taskId: string,
  details: TaskDetails,
  attemptNumber: number,
): Promise<void> {
  if (attemptNumber < MAX_ATTEMPTS) {
    console.log(`[tools/create_task] retrying task ${taskId} (attempt ${attemptNumber + 1})`);
    try {
      await placeRetryAttempt(taskId, details, attemptNumber + 1);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      console.error(`[tools/create_task] retry call failed:`, detail);
      await failTaskAndNotify(taskId, `I tried calling ${details.entityName} but the retry failed.`);
    }
  } else {
    await failTaskAndNotify(
      taskId,
      `I tried calling ${details.entityName} but no one answered after multiple attempts.`,
    );
  }
}

/**
 * Mark a task as failed and notify the user with the given message.
 */
async function failTaskAndNotify(
  taskId: string,
  message: string,
): Promise<void> {
  await updateTaskStatus(taskId, "failed", { outcome: { result: message } });
  console.log(`[tools/create_task] task ${taskId} marked failed: ${message}`);
  await notifyUser({ taskId, message });
}

/**
 * Final safety net: if the task is still in_progress after COMPLETION_TIMEOUT_MS,
 * mark it as failed and notify the user. Catches any stuck state.
 */
async function checkFinalTimeout(taskId: string): Promise<void> {
  const task = await getTask(taskId);
  if (!task || task.status === "completed" || task.status === "failed") {
    return;
  }

  console.log(`[tools/create_task] final timeout for task ${taskId}`);
  const details = task.details as TaskDetails;
  await failTaskAndNotify(
    taskId,
    `I called ${details.entityName} but couldn't complete the task. Sorry about that.`,
  );
}
