-- CreateIndex
CREATE UNIQUE INDEX "Submission_challengeId_userId_key" ON "Submission"("challengeId", "userId");

