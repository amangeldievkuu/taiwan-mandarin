-- Practice away from the cards (stories, Talk, writing), counted into the daily totals for XP.
CREATE TABLE "PracticeLog" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PracticeLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PracticeLog_userId_at_idx" ON "PracticeLog"("userId", "at");

CREATE INDEX "PracticeLog_userId_createdAt_idx" ON "PracticeLog"("userId", "createdAt");

ALTER TABLE "PracticeLog" ADD CONSTRAINT "PracticeLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
