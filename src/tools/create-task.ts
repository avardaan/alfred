import { eq } from "drizzle-orm";
import { normalizePhone } from "../db/users.ts";
import { db } from "../db/client.ts";
import { users } from "../db/schema.ts";
import {
  createAttempt,
  createTask,
  getTask,
  updateAttempt,
  updateTaskStatus,
} from "../db/tasks.ts";
import { createElevenLabsClient } from "../elevenlabs/client.ts";
import {
  getConversationStatus,
  placeNotificationCall,
  placeOutboundCall,
} from "../elevenlabs/outbound-call.ts";

type CreateTaskBody = {
  phone?: string;
  entity_name?: string;
  conversation_id?: string;
  user_id?: string;
};

const COMPLETION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Resolve the user ID for a tool webhook call.
 * ElevenLabs tool webhooks don't include user_id directly, but they do send
 * conversation_id. We use that to fetch the conversation metadata, which
 * contains the userId set by the init webhook.
 */
async function resolveUserId(
  body: CreateTaskBody,
): Promise<{ userId: string | undefined; conversationId: string | undefined }> {
  // If ElevenLabs ever starts sending user_id directly, use it
  if (body.user_id) {
    return { userId: body.user_id, conversationId: body.conversation_id };
  }

  const conversationId = body.conversation_id;
  if (!conversationId) {
    return { userId: undefined, conversationId: undefined };
  }

  try {
    const client = createElevenLabsClient();
    const conv = await client.conversationalAi.conversations.get(conversationId);
    return { userId: conv.userId ?? undefined, conversationId };
  } catch (error) {
    console.error(`[tools/create_task] failed to look up conversation ${conversationId}:`, error);
    return { userId: undefined, conversationId };
  }
}

export async function handleCreateTaskTool(req: Request): Promise<Response> {
  let body: CreateTaskBody;

  try {
    body = (await req.json()) as CreateTaskBody;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  console.log(`[tools/create_task] raw body keys: ${Object.keys(body).join(", ")}`);

  const phone = body.phone?.trim();
  const entityName = body.entity_name?.trim();

  console.log(
    `[tools/create_task] phone=${phone ?? "(none)"} entity=${entityName} conv=${body.conversation_id ?? "none"}`,
  );

  if (!phone || !entityName) {
    return Response.json({
      result: "Error: missing phone or entity_name. Use lookup_business first to get the phone number.",
    });
  }

  const { userId } = await resolveUserId(body);

  console.log(`[tools/create_task] resolved userId=${userId ?? "none"}`);

  if (!userId) {
    return Response.json({
      result: "Error: could not identify the user. Please ensure you're a registered user.",
    });
  }

  const resolvedPhone = normalizePhone(phone);

  // Create the task row
  const task = await createTask(userId, "ask_hours", {
    phone: resolvedPhone,
    entityName,
  });

  // Place the outbound call
  let batchCallId: string;
  try {
    const result = await placeOutboundCall({
      phoneNumber: resolvedPhone,
      taskId: task.id,
    });
    batchCallId = result.batchCallId;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    console.error(`[tools/create_task] outbound call failed:`, detail);
    await updateTaskStatus(task.id, "failed", { outcome: { hours: "" } });
    return Response.json({
      result: `I tried to call ${entityName} but something went wrong: ${detail}`,
    });
  }

  // Create an attempt record
  const attempt = await createAttempt(task.id, { elevenlabsBatchCallId: batchCallId });
  await updateAttempt(attempt.id, "in_progress");
  await updateTaskStatus(task.id, "in_progress");

  // Set a completion timeout fallback
  setTimeout(() => checkTaskTimeout(task.id, attempt.id, batchCallId), COMPLETION_TIMEOUT_MS);

  return Response.json({
    result: `I'll call ${entityName} now and report back with their hours.`,
  });
}

/**
 * Fallback: if submit_task_result hasn't arrived after 5 minutes, check if the
 * conversation has ended. If so, mark the task as failed and notify the user.
 */
async function checkTaskTimeout(
  taskId: string,
  attemptId: string,
  batchCallId: string,
): Promise<void> {
  const task = await getTask(taskId);
  if (!task || task.status === "completed" || task.status === "failed") {
    return; // Already resolved
  }

  console.log(`[tools/create_task] timeout check for task ${taskId} (batch ${batchCallId})`);

  // Try to get conversation status from the batch call
  try {
    const client = createElevenLabsClient();
    const batchCall = await client.conversationalAi.batchCalls.get(batchCallId);

    const recipient = batchCall.recipients[0];
    if (recipient?.conversationId) {
      const status = await getConversationStatus(recipient.conversationId);
      console.log(`[tools/create_task] conversation ${recipient.conversationId} status: ${status}`);

      if (status === "done" || status === "failed") {
        await updateAttempt(attemptId, "failed", {
          elevenlabsConversationId: recipient.conversationId,
          failureReason: "Conversation ended without submit_task_result",
        });
        await updateTaskStatus(taskId, "failed", { outcome: { hours: "" } });

        // Notify the user
        const details = task.details as { phone: string; entityName: string };
        const userRows = await db.select().from(users).where(eq(users.id, task.userId)).limit(1);
        const userPhone = userRows[0]?.phoneNumbers[0];

        if (userPhone) {
          try {
            await placeNotificationCall({
              phoneNumber: userPhone,
              message: `Hi, I called ${details.entityName} but couldn't get their hours. Sorry about that.`,
            });
          } catch (error) {
            console.error(`[tools/create_task] timeout notification failed:`, error);
          }
        }
      }
    }
  } catch (error) {
    console.error(`[tools/create_task] timeout check failed:`, error);
  }
}
