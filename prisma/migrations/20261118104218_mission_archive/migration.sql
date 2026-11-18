-- CreateTable
CREATE TABLE "Mission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "profile" TEXT NOT NULL,
    "paint" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "gates" INTEGER NOT NULL,
    "collisions" INTEGER NOT NULL,
    "score" INTEGER NOT NULL
);

-- CreateIndex
CREATE INDEX "Mission_createdAt_idx" ON "Mission"("createdAt");

-- CreateIndex
CREATE INDEX "Mission_score_idx" ON "Mission"("score");
