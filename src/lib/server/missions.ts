import type { MissionDetail, MissionSummary } from "@/domain/mission";
import { isPaintId } from "@/domain/config";
import type { MissionSubmission } from "@/lib/validation/mission";
import { telemetrySampleSchema } from "@/lib/validation/mission";
import type { TelemetrySample } from "@/sim/mission";
import { isEngineId } from "@/sim/profiles";
import { z } from "zod";
import { getDb } from "./db";

/** Repository for mission records. Route handlers stay thin; this owns persistence. */

interface Row {
  id: string;
  createdAt: Date;
  callsign: string;
  outcome: string;
  engine: string;
  paint: string;
  durationMs: number;
  score: number;
  checkpoints: number;
  collisions: number;
  maxSpeed: number;
  avgSpeed: number;
  energyUsed: number;
  telemetry: string;
}

const storedTraceSchema = z.object({
  samples: z.array(telemetrySampleSchema),
  splitsMs: z.array(z.number()),
});

function toSummary(r: Row): MissionSummary {
  return {
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    callsign: r.callsign,
    outcome: r.outcome === "success" ? "success" : "failed",
    engine: isEngineId(r.engine) ? r.engine : "SPORT",
    paint: isPaintId(r.paint) ? r.paint : "graphite",
    durationMs: r.durationMs,
    score: r.score,
    checkpoints: r.checkpoints,
    collisions: r.collisions,
    maxSpeed: r.maxSpeed,
    avgSpeed: r.avgSpeed,
    energyUsed: r.energyUsed,
  };
}

function toDetail(r: Row): MissionDetail {
  let samples: TelemetrySample[] = [];
  let splitsMs: number[] = [];
  try {
    const parsed = storedTraceSchema.safeParse(JSON.parse(r.telemetry));
    if (parsed.success) {
      samples = parsed.data.samples;
      splitsMs = parsed.data.splitsMs;
    }
  } catch {
    // A corrupt trace must not break the record; it is shown without a chart.
  }
  return { ...toSummary(r), telemetry: samples, splitsMs };
}

const summarySelect = {
  id: true,
  createdAt: true,
  callsign: true,
  outcome: true,
  engine: true,
  paint: true,
  durationMs: true,
  score: true,
  checkpoints: true,
  collisions: true,
  maxSpeed: true,
  avgSpeed: true,
  energyUsed: true,
} as const;

export async function createMission(m: MissionSubmission): Promise<MissionDetail> {
  const row = await getDb().missionRecord.create({
    data: {
      callsign: m.callsign,
      outcome: m.outcome,
      engine: m.engine,
      paint: m.paint,
      durationMs: m.durationMs,
      score: m.score,
      checkpoints: m.checkpoints,
      collisions: m.collisions,
      maxSpeed: m.maxSpeed,
      avgSpeed: m.avgSpeed,
      energyUsed: m.energyUsed,
      telemetry: JSON.stringify({ samples: m.telemetry, splitsMs: m.splitsMs }),
      clientBuild: m.clientBuild ?? "unknown",
    },
  });
  return toDetail(row);
}

export async function listMissions(opts: {
  limit: number;
  outcome?: "success" | "failed";
  engine?: string;
}): Promise<{ missions: MissionSummary[]; total: number }> {
  const where = {
    ...(opts.outcome ? { outcome: opts.outcome } : {}),
    ...(opts.engine ? { engine: opts.engine } : {}),
  };
  const db = getDb();
  const [rows, total] = await Promise.all([
    db.missionRecord.findMany({ where, orderBy: { createdAt: "desc" }, take: opts.limit, select: summarySelect }),
    db.missionRecord.count({ where }),
  ]);
  return { missions: rows.map((r) => toSummary({ ...r, telemetry: "" })), total };
}

export async function getMission(id: string): Promise<MissionDetail | null> {
  const row = await getDb().missionRecord.findUnique({ where: { id } });
  return row ? toDetail(row) : null;
}

/** Successful missions ranked by score, ties broken by faster time then earlier date. */
export async function leaderboard(opts: { limit: number; engine?: string }): Promise<MissionSummary[]> {
  const rows = await getDb().missionRecord.findMany({
    where: { outcome: "success", ...(opts.engine ? { engine: opts.engine } : {}) },
    orderBy: [{ score: "desc" }, { durationMs: "asc" }, { createdAt: "asc" }],
    take: opts.limit,
    select: summarySelect,
  });
  return rows.map((r) => toSummary({ ...r, telemetry: "" }));
}
