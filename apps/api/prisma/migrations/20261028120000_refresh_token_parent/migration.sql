-- Which token a refresh token replaced. A rotated token may be used again while its replacement
-- is unused (the response never reached the client), instead of ending the session.
ALTER TABLE "RefreshToken" ADD COLUMN "parentId" UUID;
CREATE INDEX "RefreshToken_parentId_idx" ON "RefreshToken"("parentId");
