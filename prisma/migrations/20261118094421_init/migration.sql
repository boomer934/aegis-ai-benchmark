-- CreateTable
CREATE TABLE "MissionRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "callsign" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "paint" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "checkpoints" INTEGER NOT NULL,
    "collisions" INTEGER NOT NULL,
    "maxSpeed" REAL NOT NULL,
    "avgSpeed" REAL NOT NULL,
    "energyUsed" REAL NOT NULL,
    "telemetry" TEXT NOT NULL,
    "clientBuild" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "MissionRecord_outcome_score_idx" ON "MissionRecord"("outcome", "score");

-- CreateIndex
CREATE INDEX "MissionRecord_createdAt_idx" ON "MissionRecord"("createdAt");
