import type { ElevenLabs } from "@elevenlabs/elevenlabs-js";
import { config, requireElevenLabsApiKey } from "../config.ts";
import { createElevenLabsClient } from "./client.ts";

/**
 * Place an outbound call to a business via the ElevenLabs Batch Calls API.
 * The outbound agent receives `task_id` as a dynamic variable so it can pass it
 * to the `submit_task_result` tool.
 */
export async function placeOutboundCall(params: {
  phoneNumber: string;
  taskId: string;
  instruction: string;
}): Promise<{ batchCallId: string }> {
  const client = createElevenLabsClient();
  const outboundAgentId = config.elevenLabsOutboundAgentId;
  const agentPhoneNumberId = config.elevenLabsPhoneNumberId;
  if (!outboundAgentId) {
    throw new Error("Missing ELEVENLABS_OUTBOUND_AGENT_ID. Run `bun run setup` first.");
  }
  if (!agentPhoneNumberId) {
    throw new Error("Missing ELEVENLABS_PHONE_NUMBER_ID. Run `bun run import:twilio` first.");
  }

  const batchCall = await client.conversationalAi.batchCalls.create({
    callName: `task-${params.taskId}`,
    agentId: outboundAgentId,
    agentPhoneNumberId,
    recipients: [
      {
        phoneNumber: params.phoneNumber,
        conversationInitiationClientData: {
          dynamicVariables: {
            task_id: params.taskId,
            task_instruction: params.instruction,
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
  taskId: string;
}): Promise<{ batchCallId: string }> {
  const client = createElevenLabsClient();
  const inboundAgentId = config.elevenLabsAgentId;
  const agentPhoneNumberId = config.elevenLabsPhoneNumberId;
  if (!inboundAgentId) {
    throw new Error("Missing ELEVENLABS_AGENT_ID. Run `bun run setup` first.");
  }
  if (!agentPhoneNumberId) {
    throw new Error("Missing ELEVENLABS_PHONE_NUMBER_ID. Run `bun run import:twilio` first.");
  }

  const batchCall = await client.conversationalAi.batchCalls.create({
    callName: `notify-${params.taskId.slice(0, 8)}`,
    agentId: inboundAgentId,
    agentPhoneNumberId,
    recipients: [
      {
        phoneNumber: params.phoneNumber,
        conversationInitiationClientData: {
          conversationConfigOverride: {
            agent: {
              firstMessage: params.message,
            },
          },
          dynamicVariables: {
            notification_message: params.message,
            task_id: params.taskId,
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
 * Send a notification to the user via WhatsApp using a pre-approved message template.
 * The template "alfred_client_generic" has one body parameter: the result message.
 * Returns a conversation_id for tracking.
 */
export async function sendWhatsAppNotification(params: {
  whatsappUserId: string;
  message: string;
}): Promise<{ conversationId: string }> {
  const client = createElevenLabsClient();
  const agentId = config.elevenLabsAgentId;
  const whatsappPhoneNumberId = config.elevenLabsWhatsappPhoneNumberId;
  const templateName = config.whatsappTemplateName;
  const templateLanguageCode = config.whatsappTemplateLanguageCode ?? "en_US";

  if (!agentId) {
    throw new Error("Missing ELEVENLABS_AGENT_ID. Run `bun run setup` first.");
  }
  if (!whatsappPhoneNumberId) {
    throw new Error("Missing ELEVENLABS_WHATSAPP_PHONE_NUMBER_ID.");
  }
  if (!templateName) {
    throw new Error("Missing WHATSAPP_TEMPLATE_NAME.");
  }

  const response = await fetch("https://api.elevenlabs.io/v1/convai/whatsapp/outbound-message", {
    method: "POST",
    headers: {
 "xi-api-key": requireElevenLabsApiKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      whatsapp_phone_number_id: whatsappPhoneNumberId,
      whatsapp_user_id: params.whatsappUserId,
      template_name: templateName,
      template_language_code: templateLanguageCode,
      template_params: [
        {
          type: "body",
          parameters: [
            {
              type: "text",
              text: params.message,
            },
          ],
        },
      ],
      agent_id: agentId,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`WhatsApp outbound message failed (${response.status}): ${errorText}`);
  }

  const data = await response.json() as { conversation_id: string };
  console.log(
    `[outbound] whatsapp notification → conversation ${data.conversation_id} (${params.whatsappUserId})`,
  );

  return { conversationId: data.conversation_id };
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
