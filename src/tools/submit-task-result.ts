import { eq } from "drizzle-orm";
import { db } from "../db/client.ts";
import { users } from "../db/schema.ts";
import {
  findAttemptByConversationId,
  getTask,
  updateAttempt,
  updateTaskStatus,
} from "../db/tasks.ts";
import { placeNotificationCall } from "../elevenlabs/outbound-call.ts";

type SubmitTaskResultBody = {
  task_id?: string;
  hours?: string;
  success?: boolean;
  conversation_id?: string;
};

export async function handleSubmitTaskResultTool(req: Request): Promise<Response> {
  let body: SubmitTaskResultBody;

  try {
    body = (await req.json()) as SubmitTaskResultBody;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const taskId = body.task_id;
  const hours = typeof body.hours === "string" ? body.hours : "";
  const success = body.success !== false;
  const conversationId = body.conversation_id;

  console.log(
    `[tools/submit_task_result] task=${taskId} success=${success} hours=${hours.slice(0, 80)} conv=${conversationId ?? "none"}`,
  );

  if (!taskId) {
    return Response.json({ result: "Error: missing task_id." });
  }

  const task = await getTask(taskId);
  if (!task) {
    console.error(`[tools/submit_task_result] task ${taskId} not found`);
    return Response.json({ result: "Error: task not found." });
  }

  await updateTaskStatus(taskId, success ? "completed" : "failed", {
    outcome: { hours },
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

  // Notify the user via voice callback
  const details = task.details as { phone: string; entityName: string };
  const message = success
    ? `Hi, I called ${details.entityName}. Their hours are: ${hours}.`
    : `Hi, I tried calling ${details.entityName} but couldn't get their hours. Sorry about that.`;

  // Find the user's phone number to call back
  const userPhone = await getUserPhoneForTask(task.userId);
  if (userPhone) {
    try {
      await placeNotificationCall({ phoneNumber: userPhone, message });
    } catch (error) {
      console.error(`[tools/submit_task_result] notification call failed:`, error);
    }
  } else {
    console.error(`[tools/submit_task_result] no phone number found for user ${task.userId}`);
  }

  return Response.json({
    result: success
      ? "Result recorded. Thank you, goodbye."
      : "Failure recorded. Thank you, goodbye.",
  });
}

async function getUserPhoneForTask(userId: string): Promise<string | undefined> {
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return rows[0]?.phoneNumbers[0];
}
