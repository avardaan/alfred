import { arrayContains } from "drizzle-orm";
import { parsePhoneNumber } from "libphonenumber-js";

import { ALFRED_GREETING } from "../assistant/alfred.ts";
import { db } from "./client.ts";
import { users, type User } from "./schema.ts";

export type { User };

/**
 * Normalize a phone number to E.164 (`+<country><subscriber>`, no formatting).
 *
 * Routing by shape so libphonenumber gets the right country context:
 *  - `+` prefix → country code is explicit, parse as-is
 *  - bare 10 digits → US national number (Alfred's primary voice market)
 *  - anything else with digits → prepend `+` and let libphonenumber detect the
 *    country (handles Indian WhatsApp `919876543210` → `+919876543210`, and
 *    `15109792557` → `+15109792557`).
 *
 * Always returns a string and never throws; unparseable input falls back to the
 * trimmed original, which won't match any stored E.164 number (safe no-match).
 */
export function normalizePhone(phone: string): string {
  const trimmed = phone.trim();
  if (!trimmed) {
    return "";
  }

  const digits = trimmed.replace(/\D/g, "");

  let parseInput = trimmed;
  let defaultCountry: "US" | undefined;

  if (trimmed.startsWith("+")) {
    parseInput = trimmed;
  } else if (digits.length === 10) {
    parseInput = digits;
    defaultCountry = "US";
  } else if (digits) {
    parseInput = `+${digits}`;
  } else {
    return trimmed;
  }

  try {
    const parsed = defaultCountry
      ? parsePhoneNumber(parseInput, defaultCountry)
      : parsePhoneNumber(parseInput);
    if (parsed) {
      return parsed.number;
    }
  } catch {
    // unparseable — fall through to digit-based E.164
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
