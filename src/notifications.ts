import { createAttempt } from "./db/tasks.ts";
import { getUserPhoneForTask } from "./db/tasks.ts";
import { placeNotificationCall } from "./elevenlabs/outbound-call.ts";

/**
 * Notify the user of a task result via a voice call. Places the notification
 * call and tracks it as a call_attempt with type "notification" so the post-call
 * webhook can update its status when the call ends.
 */
export async function notifyUser(params: {
  taskId: string;
  message: string;
}): Promise<void> {
  const userPhone = await getUserPhoneForTask(params.taskId);
  if (!userPhone) {
    console.error(`[notify] no phone number found for task ${params.taskId}`);
    return;
  }

  try {
    const result = await placeNotificationCall({
      phoneNumber: userPhone,
      message: params.message,
      taskId: params.taskId,
    });
    await createAttempt(params.taskId, "notification", {
      elevenlabsBatchCallId: result.batchCallId,
    });
    console.log(`[notify] notification call placed for task ${params.taskId}`);
  } catch (error) {
    console.error(`[notify] notification call failed:`, error);
  }
}
