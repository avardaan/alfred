import {
  findAttemptByConversationId,
  findLatestWorkerAttempt,
  getTask,
  updateAttempt,
  updateTaskStatus,
} from "../db/tasks.ts";
import { notifyUser } from "../notifications.ts";
import { unauthorizedResponse, verifyWebhookSecret } from "../webhook/auth.ts";
import { MAX_ATTEMPTS, placeRetryAttempt } from "./create-task.ts";

type SubmitTaskResultBody = {
  task_id?: string;
  result?: string;
  success?: boolean;
  retry?: boolean;
  conversation_id?: string;
};

export async function handleSubmitTaskResultTool(req: Request): Promise<Response> {
  if (!verifyWebhookSecret(req)) {
    return unauthorizedResponse();
  }

  let body: SubmitTaskResultBody;

  try {
    body = (await req.json()) as SubmitTaskResultBody;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const taskId = body.task_id;
  const result = typeof body.result === "string" && body.result.trim() ? body.result : "No result provided.";
  const success = body.success !== false;
  const retry = body.retry === true;
  const conversationId = body.conversation_id;

  console.log(
    `[tools/submit_task_result] task=${taskId} success=${success} retry=${retry} result=${result.slice(0, 80)} conv=${conversationId ?? "none"}`,
  );

  if (!taskId) {
    return Response.json({ result: "Error: missing task_id." });
  }

  // Validate task_id is a UUID to prevent DB errors from hallucinated values
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_REGEX.test(taskId)) {
    console.error(`[tools/submit_task_result] invalid task_id (not a UUID): ${taskId}`);
    return Response.json({
      result: `Error: task_id must be a valid UUID. Use the exact value of the {{task_id}} dynamic variable, not a description. The task_id looks like "32c382a8-ec5d-45b4-a782-76e3bd6c29f1".`,
    });
  }

  const task = await getTask(taskId);
  if (!task) {
    console.error(`[tools/submit_task_result] task ${taskId} not found`);
    return Response.json({ result: "Error: task not found." });
  }

  // Retry branch: the outbound agent reached voicemail on a non-final attempt
  // and explicitly asked for a retry. Place another worker attempt instead of
  // completing the task. Bounded by MAX_ATTEMPTS so a hallucinated retry=true
  // on the final attempt can never loop.
  if (retry) {
    const latestAttempt = await findLatestWorkerAttempt(taskId);
    const nextAttemptNumber = (latestAttempt?.attemptNumber ?? 1) + 1;
    const details = task.details as { phone: string; entityName: string; instruction: string };

    if (nextAttemptNumber > MAX_ATTEMPTS) {
      console.error(
        `[tools/submit_task_result] retry requested past max attempts (${nextAttemptNumber} > ${MAX_ATTEMPTS}); marking failed`,
      );
      if (latestAttempt) {
        await updateAttempt(latestAttempt.id, "failed", {
          elevenlabsConversationId: conversationId,
          failureReason: "retry requested past max attempts",
        });
      }
      await updateTaskStatus(taskId, "failed", { outcome: { result } });
      await notifyUser({
        taskId,
        message: `Hi, I tried calling ${details.entityName} but couldn't complete the task. Sorry about that.`,
      });
      return Response.json({ result: "Cannot retry further. Recording failure, goodbye." });
    }

    if (latestAttempt) {
      await updateAttempt(latestAttempt.id, "completed", {
        elevenlabsConversationId: conversationId,
        failureReason: "retry requested by agent",
      });
    }
    try {
      await placeRetryAttempt(taskId, details, nextAttemptNumber);
      return Response.json({ result: "Retry scheduled. Thank you, goodbye." });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      console.error(`[tools/submit_task_result] retry attempt failed:`, detail);
      await updateTaskStatus(taskId, "failed", { outcome: { result: `Retry scheduling failed: ${detail}` } });
      await notifyUser({
        taskId,
        message: `Hi, I tried calling ${details.entityName} but couldn't complete the task. Sorry about that.`,
      });
      return Response.json({ result: "Could not schedule a retry. Recording failure, goodbye." });
    }
  }

  await updateTaskStatus(taskId, success ? "completed" : "failed", {
    outcome: { result },
  });

  if (conversationId) {
    const attempt = await findAttemptByConversationId(conversationId);
    if (attempt) {
      await updateAttempt(attempt.id, success ? "completed" : "failed", {
        elevenlabsConversationId: conversationId,
        failureReason: success ? undefined : "Agent reported failure",
      });
    }
  }

  // Notify the user (tracked as a notification call_attempt)
  const details = task.details as { phone: string; entityName: string; instruction: string };
  const message = success
    ? `Hi, I called ${details.entityName}. ${result}`
    : `Hi, I tried calling ${details.entityName} but couldn't complete the task. Sorry about that.`;

  await notifyUser({ taskId: task.id, message });

  return Response.json({
    result: success
      ? "Result recorded. Thank you, goodbye."
      : "Failure recorded. Thank you, goodbye.",
  });
}
