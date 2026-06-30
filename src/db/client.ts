import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { requireDatabaseUrl } from "../config.ts";
import * as schema from "./schema.ts";

const client = postgres(requireDatabaseUrl());
export const db = drizzle(client, { schema });
