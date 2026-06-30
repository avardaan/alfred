import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    phoneNumbers: text("phone_numbers").array().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("users_phone_numbers_gin_idx").using("gin", table.phoneNumbers)],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
