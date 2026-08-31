import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    phoneNumbers: text("phone_numbers", { mode: "json" })
      .$type<string[]>()
      .notNull(),
    primaryLocation: text("primary_location"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .notNull(),
  },
);

export const episodes = sqliteTable(
  "episodes",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    originatingConversationId: text("originating_conversation_id"),
    channel: text("channel"),
    originatingCallerId: text("originating_caller_id"),
    status: text("status").notNull().default("pending"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .notNull(),
    completedAt: integer("completed_at", { mode: "timestamp" }),
  },
  (table) => [
    index("episodes_user_id_idx").on(table.userId),
    index("episodes_originating_conversation_idx").on(table.originatingConversationId),
  ],
);

export const tasks = sqliteTable(
  "tasks",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    episodeId: text("episode_id")
      .notNull()
      .references(() => episodes.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    status: text("status").notNull().default("pending"),
    details: text("details", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull(),
    outcome: text("outcome", { mode: "json" }).$type<Record<string, unknown>>(),
    scheduledFor: integer("scheduled_for", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .notNull(),
    completedAt: integer("completed_at", { mode: "timestamp" }),
  },
  (table) => [index("tasks_episode_id_idx").on(table.episodeId)],
);

export const callAttempts = sqliteTable(
  "call_attempts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    attemptNumber: integer("attempt_number").notNull().default(1),
    elevenlabsConversationId: text("elevenlabs_conversation_id"),
    elevenlabsBatchCallId: text("elevenlabs_batch_call_id"),
    status: text("status").notNull().default("pending"),
    startedAt: integer("started_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .notNull(),
    endedAt: integer("ended_at", { mode: "timestamp" }),
    failureReason: text("failure_reason"),
  },
  (table) => [index("call_attempts_task_id_idx").on(table.taskId)],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Episode = typeof episodes.$inferSelect;
export type NewEpisode = typeof episodes.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type CallAttempt = typeof callAttempts.$inferSelect;
export type NewCallAttempt = typeof callAttempts.$inferInsert;
