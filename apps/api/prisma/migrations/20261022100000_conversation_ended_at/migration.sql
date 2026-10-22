-- A conversation the learner ended: it gets a closing line and a summary, and takes no more messages.
ALTER TABLE "Conversation" ADD COLUMN "endedAt" TIMESTAMP(3);
