import { database } from "@/lib/db";
import { submission, type Submission } from "@/lib/results";
export const dynamic = "force-dynamic";
const unavailable = () =>
  Response.json(
    { error: "Mission archive unavailable. Check the local database and retry." },
    { status: 503 },
  );
export async function GET() {
  try {
    const db = database();
    const [recent, leaders] = await db.$transaction([
      db.mission.findMany({ take: 40, orderBy: [{ createdAt: "desc" }, { id: "asc" }] }),
      db.mission.findMany({
        take: 10,
        orderBy: [
          { score: "desc" },
          { gates: "desc" },
          { durationMs: "asc" },
          { createdAt: "asc" },
          { id: "asc" },
        ],
      }),
    ]);
    return Response.json({ recent, leaders });
  } catch {
    return unavailable();
  }
}
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Expected a JSON object." }, { status: 400 });
  }
  const parsed = submission.safeParse(body);
  if (!parsed.success)
    return Response.json(
      { error: parsed.error.issues.map((i) => i.message).join(" ") },
      { status: 422 },
    );
  try {
    const data = parsed.data;
    const row = await database().mission.upsert({
      where: { id: data.id },
      create: data,
      update: {},
    });
    if ((Object.keys(data) as (keyof Submission)[]).some((k) => data[k] !== row[k]))
      return Response.json(
        { error: "Flight ID already belongs to another result." },
        { status: 409 },
      );
    return Response.json(row, { status: 200 });
  } catch {
    return unavailable();
  }
}
