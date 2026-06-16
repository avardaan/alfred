import type { ElevenLabs } from "@elevenlabs/elevenlabs-js";
import { createElevenLabsClient } from "./client.ts";

const MAIN_BRANCH_NAME = "Main";
const DEFAULT_VERSION_DESCRIPTION = "Published by Alfred sync from repo";

export async function resolveMainBranchId(agentId: string): Promise<string> {
  const client = createElevenLabsClient();
  const { results } = await client.conversationalAi.agents.branches.list(agentId);
  const main = results.find((branch) => branch.name === MAIN_BRANCH_NAME);

  if (!main) {
    throw new Error(`ElevenLabs agent ${agentId} has no "${MAIN_BRANCH_NAME}" branch.`);
  }

  return main.id;
}

export async function publishAgentUpdate(
  agentId: string,
  request: ElevenLabs.conversationalAi.UpdateAgentRequest,
  versionDescription = DEFAULT_VERSION_DESCRIPTION,
): Promise<void> {
  const client = createElevenLabsClient();
  const branchId = await resolveMainBranchId(agentId);

  await client.conversationalAi.agents.update(agentId, {
    ...request,
    branchId,
    versionDescription,
  });
}
