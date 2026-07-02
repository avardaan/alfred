import { getEpisodeByTaskId, type Episode } from "./db/episodes.ts";
import { createAttempt, getUserPhoneForTask } from "./db/tasks.ts";
import {
  placeNotificationCall,
  sendWhatsAppNotification,
} from "./elevenlabs/outbound-call.ts";

type NotificationContext = {
  taskId: string;
  message: string;
  episode: Episode | undefined;
};

type NotificationStrategy = (ctx: NotificationContext) => Promise<void>;

// --- Strategies -----------------------------------------------------------------

const voiceCallStrategy: NotificationStrategy = async ({ taskId, message }) => {
  const userPhone = await getUserPhoneForTask(taskId);
  if (!userPhone) {
    throw new Error(`No phone number found for task ${taskId}`);
  }
  const result = await placeNotificationCall({
    phoneNumber: userPhone,
    message,
    taskId,
  });
  await createAttempt(taskId, "notification", {
    elevenlabsBatchCallId: result.batchCallId,
  });
  console.log(`[notify] voice notification placed for task ${taskId}`);
};

const whatsappStrategy: NotificationStrategy = async ({ taskId, message, episode }) => {
  if (!episode?.originatingCallerId) {
    throw new Error("WhatsApp strategy requires originatingCallerId on the episode");
  }
  const result = await sendWhatsAppNotification({
    whatsappUserId: episode.originatingCallerId,
    message,
  });
  await createAttempt(taskId, "notification", {
    elevenlabsBatchCallId: result.conversationId,
  });
  console.log(`[notify] whatsapp notification sent for task ${taskId}`);
};

// --- Routing policy -------------------------------------------------------------
//
// Maps the episode's originating channel to the primary notification strategy.
// To add cross-channel (e.g. voice→whatsapp), change this function — nothing else.
// To add a new channel, add a strategy above and add a case here.

function resolvePrimaryStrategy(channel: string | null | undefined): NotificationStrategy {
  switch (channel) {
    case "whatsapp":
      return whatsappStrategy;
    case "voice":
    default:
      return voiceCallStrategy;
  }
}

// --- Fallback policy ------------------------------------------------------------
//
// Returns the strategy to try if the primary fails. WhatsApp fails → voice is
// the safe default since every user has a phone number.

function resolveFallbackStrategy(primary: NotificationStrategy): NotificationStrategy | null {
  if (primary === whatsappStrategy) {
    return voiceCallStrategy;
  }
  return null; // voice has no fallback today
}

// --- Public API -----------------------------------------------------------------

export async function notifyUser(params: {
  taskId: string;
  message: string;
}): Promise<void> {
  const episode = await getEpisodeByTaskId(params.taskId);
  const ctx: NotificationContext = { ...params, episode };

  const primary = resolvePrimaryStrategy(episode?.channel);

  try {
    await primary(ctx);
  } catch (error) {
    const fallback = resolveFallbackStrategy(primary);
    if (fallback) {
      console.error(`[notify] primary strategy failed, falling back:`, error);
      try {
        await fallback(ctx);
      } catch (fallbackError) {
        console.error(`[notify] fallback strategy also failed:`, fallbackError);
      }
    } else {
      console.error(`[notify] strategy failed (no fallback):`, error);
    }
  }
}
