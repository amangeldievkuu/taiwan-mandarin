-- Access tokens issued before this are refused: changing the password or signing out everywhere
-- ends every session at once, not only when its 15-minute token runs out.
ALTER TABLE "User" ADD COLUMN "sessionsValidFrom" TIMESTAMP(3);
