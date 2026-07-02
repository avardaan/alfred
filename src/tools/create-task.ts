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
import {
  getConversationStatus,
  placeOutboundCall,
} from "../elevenlabs/outbound-call.ts";
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
const MAX_ATTEMPTS = 2; // initial call + 1 retry

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
  const attempt = await createAttempt(task.id, "worker", { elevenlabsBatchCallId: batchCallId });
  await updateAttempt(attempt.id, "in_progress");
  await updateTaskStatus(task.id, "in_progress");

  // Schedule retry check (if no answer after ringing timeout, retry once)
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
 * Check if the call was answered. If not (status "initiated" or "failed"),
 * retry once. If max attempts reached, mark task as failed and notify user.
 */
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

    if (!recipient?.conversationId) {
      console.log(`[tools/create_task] attempt ${attemptNumber}: no conversationId`);
      await handleNoAnswer(taskId, details, attemptNumber);
      return;
    }

    const status = await getConversationStatus(recipient.conversationId);
    console.log(
      `[tools/create_task] attempt ${attemptNumber} conv ${recipient.conversationId} status: ${status}`,
    );

    // Call was answered — let the post-call webhook handle completion
    if (status === "processing" || status === "done") {
      return;
    }

    // No answer (initiated/failed/undefined) — mark attempt failed, retry or fail task
    await updateAttempt(attemptId, "failed", {
      elevenlabsConversationId: recipient.conversationId,
      failureReason: status === "initiated" ? "No answer" : `Call status: ${status ?? "unknown"}`,
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
      const result = await placeOutboundCall({
        phoneNumber: details.phone,
        taskId,
        instruction: details.instruction,
      });
      const attempt = await createAttempt(taskId, "worker", {
        elevenlabsBatchCallId: result.batchCallId,
      });
      await updateAttempt(attempt.id, "in_progress");

      setTimeout(
        () => checkAndRetry(taskId, attempt.id, result.batchCallId, attemptNumber + 1),
        RETRY_DELAY_MS,
      );
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
