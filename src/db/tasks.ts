import { eq } from "drizzle-orm";

import { db } from "./client.ts";
import { taskAttempts, tasks, type NewTask, type Task } from "./schema.ts";

export type { Task } from "./schema.ts";
export type TaskDetails = { phone: string; businessName: string };
export type TaskOutcome = { hours: string };

export async function createTask(
  userId: string,
  type: string,
  details: TaskDetails,
): Promise<Task> {
  const [task] = await db
    .insert(tasks)
    .values({
      userId,
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
  opts?: { elevenlabsBatchCallId?: string },
): Promise<typeof taskAttempts.$inferSelect> {
  const [attempt] = await db
    .insert(taskAttempts)
    .values({
      taskId,
      status: "pending",
      elevenlabsBatchCallId: opts?.elevenlabsBatchCallId,
    })
    .returning();
  if (!attempt) {
    throw new Error("Failed to create task attempt");
  }
  return attempt;
}

export async function updateAttempt(
  id: string,
  status: typeof taskAttempts.$inferSelect.status,
  opts?: {
    elevenlabsConversationId?: string;
    endedAt?: Date;
    failureReason?: string;
  },
): Promise<typeof taskAttempts.$inferSelect | undefined> {
  const [updated] = await db
    .update(taskAttempts)
    .set({
      status,
      elevenlabsConversationId: opts?.elevenlabsConversationId,
      endedAt: opts?.endedAt ?? (status === "completed" || status === "failed" ? new Date() : null),
      failureReason: opts?.failureReason,
    })
    .where(eq(taskAttempts.id, id))
    .returning();
  return updated;
}

export async function findAttemptByConversationId(
  conversationId: string,
): Promise<typeof taskAttempts.$inferSelect | undefined> {
  const rows = await db
    .select()
    .from(taskAttempts)
    .where(eq(taskAttempts.elevenlabsConversationId, conversationId))
    .limit(1);
  return rows[0];
}
