import { eq } from "drizzle-orm";

import { db } from "./client.ts";
import { callAttempts, episodes, tasks, users, type NewTask, type Task } from "./schema.ts";

export type { Task } from "./schema.ts";
export type { CallAttempt } from "./schema.ts";
export type TaskDetails = { phone: string; entityName: string; instruction: string };
export type TaskOutcome = { result: string };

export async function createTask(
  episodeId: string,
  type: string,
  details: TaskDetails,
): Promise<Task> {
  const [task] = await db
    .insert(tasks)
    .values({
      episodeId,
      type,
      status: "pending",
      details,
    } satisfies NewTask)
    .returning();
  if (!task) {
    throw new Error("Failed to create task");
  }
  return task;
}

export async function getTask(id: string): Promise<Task | undefined> {
  const rows = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  return rows[0];
}

export async function updateTaskStatus(
  id: string,
  status: Task["status"],
  opts?: { outcome?: TaskOutcome; completedAt?: Date },
): Promise<Task | undefined> {
  const [updated] = await db
    .update(tasks)
    .set({
      status,
      outcome: opts?.outcome,
      completedAt: opts?.completedAt ?? (status === "completed" || status === "failed" ? new Date() : null),
    })
    .where(eq(tasks.id, id))
    .returning();
  return updated;
}

export async function createAttempt(
  taskId: string,
  type: "worker" | "notification",
  opts?: { elevenlabsBatchCallId?: string },
): Promise<typeof callAttempts.$inferSelect> {
  const [attempt] = await db
    .insert(callAttempts)
    .values({
      taskId,
      type,
      status: "pending",
      elevenlabsBatchCallId: opts?.elevenlabsBatchCallId,
    })
    .returning();
  if (!attempt) {
    throw new Error("Failed to create call attempt");
  }
  return attempt;
}

export async function updateAttempt(
  id: string,
  status: typeof callAttempts.$inferSelect.status,
  opts?: {
    elevenlabsConversationId?: string;
    endedAt?: Date;
    failureReason?: string;
  },
): Promise<typeof callAttempts.$inferSelect | undefined> {
  const [updated] = await db
    .update(callAttempts)
    .set({
      status,
      elevenlabsConversationId: opts?.elevenlabsConversationId,
      endedAt: opts?.endedAt ?? (status === "completed" || status === "failed" ? new Date() : null),
      failureReason: opts?.failureReason,
    })
    .where(eq(callAttempts.id, id))
    .returning();
  return updated;
}

export async function findAttemptByConversationId(
  conversationId: string,
): Promise<typeof callAttempts.$inferSelect | undefined> {
  const rows = await db
    .select()
    .from(callAttempts)
    .where(eq(callAttempts.elevenlabsConversationId, conversationId))
    .limit(1);
  return rows[0];
}

/**
 * Get the user's first phone number for a task, joining through episode → users.
 */
export async function getUserPhoneForTask(taskId: string): Promise<string | undefined> {
  const rows = await db
    .select({ phone: users.phoneNumbers })
    .from(tasks)
    .innerJoin(episodes, eq(episodes.id, tasks.episodeId))
    .innerJoin(users, eq(users.id, episodes.userId))
    .where(eq(tasks.id, taskId))
    .limit(1);
  return rows[0]?.phone[0];
}
