-- Migration: restructure to episodes model
-- 1. Create episodes table
-- 2. Create one episode per existing task (data migration)
-- 3. Add episode_id FK to tasks, drop user_id + originating_conversation_id
-- 4. Rename task_attempts → call_attempts, add type column

-- Step 1: Create episodes table
CREATE TABLE "episodes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "originating_conversation_id" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "completed_at" timestamp
);

CREATE INDEX "episodes_user_id_idx" ON "episodes" ("user_id");
CREATE INDEX "episodes_originating_conversation_idx" ON "episodes" ("originating_conversation_id");

-- Step 2: Create a temp mapping table (task_id → episode_id)
CREATE TEMP TABLE task_episode_map AS
SELECT t.id AS task_id, gen_random_uuid() AS episode_id
FROM tasks t;

-- Step 3: Insert one episode per existing task
INSERT INTO episodes (id, user_id, originating_conversation_id, status, created_at, completed_at)
SELECT
  m.episode_id,
  t.user_id,
  t.originating_conversation_id,
  CASE WHEN t.status = 'completed' THEN 'completed'
       WHEN t.status = 'failed' THEN 'failed'
       ELSE 'in_progress' END,
  t.created_at,
  t.completed_at
FROM tasks t
JOIN task_episode_map m ON m.task_id = t.id;

-- Step 4: Add episode_id to tasks and populate it
ALTER TABLE "tasks" ADD COLUMN "episode_id" uuid;

UPDATE tasks t
SET episode_id = m.episode_id
FROM task_episode_map m
WHERE m.task_id = t.id;

-- Step 5: Make episode_id NOT NULL with FK
ALTER TABLE "tasks" ALTER COLUMN "episode_id" SET NOT NULL;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_episode_id_episodes_id_fk"
  FOREIGN KEY ("episode_id") REFERENCES "episodes"("id") ON DELETE CASCADE;

-- Step 6: Drop old columns and index from tasks
DROP INDEX IF EXISTS "tasks_user_id_idx";
ALTER TABLE "tasks" DROP COLUMN IF EXISTS "user_id";
ALTER TABLE "tasks" DROP COLUMN IF EXISTS "originating_conversation_id";

-- Step 7: Create new index on tasks
CREATE INDEX "tasks_episode_id_idx" ON "tasks" ("episode_id");

-- Step 8: Rename task_attempts → call_attempts
ALTER TABLE "task_attempts" RENAME TO "call_attempts";

-- Step 9: Add type column to call_attempts, default existing rows to 'worker'
ALTER TABLE "call_attempts" ADD COLUMN "type" text;
UPDATE "call_attempts" SET "type" = 'worker' WHERE "type" IS NULL;
ALTER TABLE "call_attempts" ALTER COLUMN "type" SET NOT NULL;

-- Step 10: Recreate index with correct name
DROP INDEX IF EXISTS "task_attempts_task_id_idx";
CREATE INDEX "call_attempts_task_id_idx" ON "call_attempts" ("task_id");
