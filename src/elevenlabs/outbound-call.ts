import type { ElevenLabs } from "@elevenlabs/elevenlabs-js";
import { config } from "../config.ts";
import { createElevenLabsClient } from "./client.ts";

/**
 * Place an outbound call to a business via the ElevenLabs Batch Calls API.
 * The outbound agent receives `task_id` as a dynamic variable so it can pass it
 * to the `submit_task_result` tool.
 */
export async function placeOutboundCall(params: {
  phoneNumber: string;
  taskId: string;
}): Promise<{ batchCallId: string }> {
  const client = createElevenLabsClient();
  const outboundAgentId = config.elevenLabsOutboundAgentId;
  if (!outboundAgentId) {
    throw new Error("Missing ELEVENLABS_OUTBOUND_AGENT_ID. Run `bun run setup` first.");
  }

  const batchCall = await client.conversationalAi.batchCalls.create({
    callName: `task-${params.taskId}`,
    agentId: outboundAgentId,
    recipients: [
      {
        phoneNumber: params.phoneNumber,
        conversationInitiationClientData: {
          dynamicVariables: {
            task_id: params.taskId,
          },
        },
      },
    ],
  });

  console.log(
    `[outbound] task ${params.taskId} → batch call ${batchCall.id} (${params.phoneNumber})`,
  );

  return { batchCallId: batchCall.id };
}

/**
 * Place a notification call back to the user with a result message.
 * Uses the inbound Alfred agent so the user recognizes the voice.
 * Overrides `first_message` via `conversationConfigOverride` to speak the result.
 */
export async function placeNotificationCall(params: {
  phoneNumber: string;
  message: string;
}): Promise<{ batchCallId: string }> {
  const client = createElevenLabsClient();
  const inboundAgentId = config.elevenLabsAgentId;
  if (!inboundAgentId) {
    throw new Error("Missing ELEVENLABS_AGENT_ID. Run `bun run setup` first.");
  }

  const batchCall = await client.conversationalAi.batchCalls.create({
    callName: `notify-${Date.now()}`,
    agentId: inboundAgentId,
    recipients: [
      {
        phoneNumber: params.phoneNumber,
        conversationInitiationClientData: {
          conversationConfigOverride: {
            agent: {
              firstMessage: params.message,
            },
          },
        },
      },
    ],
  });

  console.log(
    `[outbound] notification → batch call ${batchCall.id} (${params.phoneNumber})`,
  );

  return { batchCallId: batchCall.id };
}

/**
 * Fetch conversation status from ElevenLabs to check if an outbound call has ended.
 */
export async function getConversationStatus(
  conversationId: string,
): Promise<ElevenLabs.GetConversationResponseModelStatus | undefined> {
  const client = createElevenLabsClient();
  const conversation = await client.conversationalAi.conversations.get(conversationId);
  return conversation.status;
}
