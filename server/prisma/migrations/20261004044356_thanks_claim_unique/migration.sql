-- CreateIndex
CREATE UNIQUE INDEX "Claim_postId_userId_key" ON "Claim"("postId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Thanks_postId_toId_key" ON "Thanks"("postId", "toId");

