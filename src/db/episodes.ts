import { eq } from "drizzle-orm";

import { db } from "./client.ts";
import { episodes, tasks, type Episode, type NewEpisode } from "./schema.ts";

export type { Episode } from "./schema.ts";

export async function createEpisode(
  userId: string,
  originatingConversationId?: string,
  channel?: string,
  originatingCallerId?: string,
): Promise<Episode> {
  const [episode] = await db
    .insert(episodes)
    .values({
      userId,
      originatingConversationId,
      channel,
      originatingCallerId,
      status: "in_progress",
    } satisfies NewEpisode)
    .returning();
  if (!episode) {
    throw new Error("Failed to create episode");
  }
  return episode;
}

export async function getEpisode(id: string): Promise<Episode | undefined> {
  const rows = await db.select().from(episodes).where(eq(episodes.id, id)).limit(1);
  return rows[0];
}

export async function updateEpisodeStatus(
  id: string,
  status: Episode["status"],
): Promise<Episode | undefined> {
  const [updated] = await db
    .update(episodes)
    .set({
      status,
      completedAt: status === "completed" || status === "failed" ? new Date() : null,
    })
    .where(eq(episodes.id, id))
    .returning();
  return updated;
}

export async function getEpisodeByTaskId(
  taskId: string,
): Promise<Episode | undefined> {
  const rows = await db
    .select({
      id: episodes.id,
      userId: episodes.userId,
      originatingConversationId: episodes.originatingConversationId,
      channel: episodes.channel,
      originatingCallerId: episodes.originatingCallerId,
      status: episodes.status,
      createdAt: episodes.createdAt,
      completedAt: episodes.completedAt,
    })
    .from(episodes)
    .innerJoin(tasks, eq(tasks.episodeId, episodes.id))
    .where(eq(tasks.id, taskId))
    .limit(1);
  return rows[0];
}
