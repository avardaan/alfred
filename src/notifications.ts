import { getEpisodeByTaskId } from "./db/episodes.ts";
import { createAttempt } from "./db/tasks.ts";
import { getUserPhoneForTask } from "./db/tasks.ts";
import {
  placeNotificationCall,
  sendWhatsAppNotification,
} from "./elevenlabs/outbound-call.ts";

/**
 * Notify the user of a task result. Routes based on the episode's originating
 * channel: WhatsApp episodes get a WhatsApp message, voice episodes get a
 * voice call. Both are tracked as call_attempts with type "notification".
 */
export async function notifyUser(params: {
  taskId: string;
  message: string;
}): Promise<void> {
  const episode = await getEpisodeByTaskId(params.taskId);

  // WhatsApp channel: send via WhatsApp outbound message API
  if (episode?.channel === "whatsapp" && episode.originatingCallerId) {
    try {
      const result = await sendWhatsAppNotification({
        whatsappUserId: episode.originatingCallerId,
        message: params.message,
      });
      await createAttempt(params.taskId, "notification", {
        elevenlabsBatchCallId: result.conversationId,
      });
      console.log(`[notify] whatsapp notification sent for task ${params.taskId}`);
    } catch (error) {
      console.error(`[notify] whatsapp notification failed, falling back to voice:`, error);
      await notifyViaVoice(params.taskId, params.message);
    }
    return;
  }

  // Voice channel (or unknown): place a voice call
  await notifyViaVoice(params.taskId, params.message);
}

async function notifyViaVoice(taskId: string, message: string): Promise<void> {
  const userPhone = await getUserPhoneForTask(taskId);
  if (!userPhone) {
    console.error(`[notify] no phone number found for task ${taskId}`);
    return;
  }

  try {
    const result = await placeNotificationCall({
      phoneNumber: userPhone,
      message,
      taskId,
    });
    await createAttempt(taskId, "notification", {
      elevenlabsBatchCallId: result.batchCallId,
    });
    console.log(`[notify] notification call placed for task ${taskId}`);
  } catch (error) {
    console.error(`[notify] notification call failed:`, error);
  }
}
