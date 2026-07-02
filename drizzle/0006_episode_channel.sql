-- Add channel and originating_caller_id to episodes
ALTER TABLE "episodes" ADD COLUMN "channel" text;
ALTER TABLE "episodes" ADD COLUMN "originating_caller_id" text;
