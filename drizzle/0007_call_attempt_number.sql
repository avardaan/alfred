-- Track the 1-indexed attempt number on each call attempt so the outbound
-- worker agent can branch its voicemail behavior (deliver vs. retry) and the
-- server can decide retries unambiguously.
ALTER TABLE "call_attempts" ADD COLUMN "attempt_number" integer NOT NULL DEFAULT 1;