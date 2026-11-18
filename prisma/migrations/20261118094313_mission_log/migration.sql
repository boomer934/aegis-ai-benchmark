-- CreateTable
CREATE TABLE "Mission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profile" TEXT NOT NULL,
    "paint" TEXT NOT NULL,
    "lights" BOOLEAN NOT NULL,
    "outcome" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "checkpoints" INTEGER NOT NULL,
    "collisions" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "energy" REAL NOT NULL,
    "samples" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Mission_createdAt_idx" ON "Mission"("createdAt");

-- CreateIndex
CREATE INDEX "Mission_outcome_score_durationMs_idx" ON "Mission"("outcome", "score", "durationMs");
