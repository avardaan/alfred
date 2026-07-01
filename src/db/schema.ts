import { sql } from "drizzle-orm";
import { check, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    phoneNumbers: text("phone_numbers").array().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("users_phone_numbers_gin_idx").using("gin", table.phoneNumbers),
    check(
      "users_phone_numbers_e164",
      sql`array_to_string(${table.phoneNumbers}, '|') ~ '^[+][1-9][0-9]{6,14}([|][+][1-9][0-9]{6,14})*$'`,
    ),
  ],
);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    status: text("status").notNull().default("pending"),
    details: jsonb("details").notNull(),
    outcome: jsonb("outcome"),
    scheduledFor: timestamp("scheduled_for"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [index("tasks_user_id_idx").on(table.userId)],
);

export const taskAttempts = pgTable(
  "task_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    elevenlabsConversationId: text("elevenlabs_conversation_id"),
    elevenlabsBatchCallId: text("elevenlabs_batch_call_id"),
    status: text("status").notNull().default("pending"),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    endedAt: timestamp("ended_at"),
    failureReason: text("failure_reason"),
  },
  (table) => [index("task_attempts_task_id_idx").on(table.taskId)],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type TaskAttempt = typeof taskAttempts.$inferSelect;
export type NewTaskAttempt = typeof taskAttempts.$inferInsert;
