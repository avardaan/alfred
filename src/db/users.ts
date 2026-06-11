import { readFileSync } from "node:fs";

import { ALFRED_GREETING } from "../assistant/alfred.ts";

const DB_PATH = new URL("../../db/db.json", import.meta.url);

export type User = {
  id: string;
  phone_numbers: string[];
  name: string;
};

type DbFile = {
  users: User[];
};

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
  return user.phone_numbers.map(normalizePhone).filter(Boolean);
}

function loadUsers(): User[] {
  const raw = readFileSync(DB_PATH, "utf-8");
  const db = JSON.parse(raw) as DbFile;
  return db.users ?? [];
}

export function findUserByPhone(phone: string): User | undefined {
  const normalized = normalizePhone(phone);
  return loadUsers().find((user) => userPhoneNumbers(user).includes(normalized));
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
