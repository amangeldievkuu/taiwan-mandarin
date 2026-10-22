-- The learner's time zone (from sync), so the nightly FSRS fit counts days where they live, and
-- the review count of the last attempted fit, so one that failed isn't retried every night.
ALTER TABLE "User" ADD COLUMN "timeZone" TEXT,
ADD COLUMN "fsrsAttemptedCount" INTEGER NOT NULL DEFAULT 0;
