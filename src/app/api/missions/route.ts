import { db } from "@/lib/prisma";
import { resultSchema, type MissionRecord } from "@/features/telemetry/validation";
import type { Mission } from "@/generated/prisma/client";

export const runtime = "nodejs";
const maxBytes = 32_768;

function publicRecord({ createdAt, ...fields }: Mission): MissionRecord {
  return { ...resultSchema.parse(fields), createdAt: createdAt.toISOString() };
}

function unavailable(error: unknown) {
  console.error("Mission database request failed", error);
  return Response.json(
    { error: "Mission storage is unavailable. Confirm the database setup and retry." },
    { status: 503 },
  );
}

export async function GET() {
  try {
    const [history, leaderboard] = await db.$transaction([
      db.mission.findMany({ orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: 30 }),
      db.mission.findMany({
        where: { outcome: "success" },
        orderBy: [{ score: "desc" }, { durationMs: "asc" }, { createdAt: "asc" }, { id: "asc" }],
        take: 10,
      }),
    ]);
    return Response.json({
      history: history.map(publicRecord),
      leaderboard: leaderboard.map(publicRecord),
    });
  } catch (error) {
    return unavailable(error);
  }
}

export async function POST(request: Request) {
  if (!request.body)
    return Response.json({ error: "Send a JSON mission result." }, { status: 400 });
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let length = 0;
  let raw = "";
  let body: unknown;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) {
        await reader.cancel();
        return Response.json({ error: "Mission result exceeds 32 KiB." }, { status: 413 });
      }
      raw += decoder.decode(value, { stream: true });
    }
    body = JSON.parse(raw + decoder.decode());
  } catch {
    return Response.json({ error: "Send a valid JSON mission result." }, { status: 400 });
  } finally {
    reader.releaseLock();
  }
  const validated = resultSchema.safeParse(body);
  if (!validated.success) {
    return Response.json(
      { error: "Mission result failed validation.", issues: validated.error.issues },
      { status: 422 },
    );
  }
  const data = validated.data;
  try {
    const { createdAt, ...fields } = await db.mission.upsert({
      where: { id: data.id },
      create: data,
      update: {},
    });
    const stored = resultSchema.parse(fields);
    if (JSON.stringify(stored) !== JSON.stringify(data)) {
      return Response.json(
        { error: "A different run already uses that identifier." },
        { status: 409 },
      );
    }
    return Response.json({ ...stored, createdAt: createdAt.toISOString() }, { status: 201 });
  } catch (error) {
    return unavailable(error);
  }
}
