-- Sync looks up the days with reviews stored since its last visit.
CREATE INDEX "ReviewLog_userId_createdAt_idx" ON "ReviewLog"("userId", "createdAt");
