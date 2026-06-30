import { arrayContains } from "drizzle-orm";

import { ALFRED_GREETING } from "../assistant/alfred.ts";
import { db } from "./client.ts";
import { users, type User } from "./schema.ts";

export type { User };

export function normalizePhone(phone: string): string {
  const trimmed = phone.trim();
  if (!trimmed) {
    return trimmed;
  }

  if (trimmed.startsWith("+")) {
    return `+${trimmed.slice(1).replace(/\D/g, "")}`;
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  return digits ? `+${digits}` : trimmed;
}

export function userPhoneNumbers(user: User): string[] {
  return user.phoneNumbers.map(normalizePhone).filter(Boolean);
}

export async function findUserByPhone(phone: string): Promise<User | undefined> {
  const normalized = normalizePhone(phone);
  const rows = await db
    .select()
    .from(users)
    .where(arrayContains(users.phoneNumbers, [normalized]))
    .limit(1);
  return rows[0];
}

export function greetingForUser(user: User | undefined): string {
  if (user?.name) {
    return `Hello ${user.name}, this is Alfred. What can I do for you?`;
  }

  return ALFRED_GREETING;
}

export function callerNameVariable(user: User | undefined): string {
  return user?.name ?? "there";
}
