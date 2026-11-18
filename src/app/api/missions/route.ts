import { NextResponse, type NextRequest } from "next/server";
import { databaseError, jsonError, noStore, zodIssues } from "@/lib/server/http";
import { createMission, listMissions } from "@/lib/server/missions";
import {
  checkMissionPlausibility,
  missionQuerySchema,
  missionSubmissionSchema,
} from "@/lib/validation/mission";

export const dynamic = "force-dynamic";

/** Reject oversized bodies before parsing (a full trace is ~15 KB). */
const MAX_BODY_BYTES = 64 * 1024;

export async function GET(req: NextRequest) {
  const parsed = missionQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return jsonError(400, "Invalid query parameters", zodIssues(parsed.error));
  try {
    const result = await listMissions(parsed.data);
    return NextResponse.json(result, noStore);
  } catch (err) {
    return databaseError(err);
  }
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json"))
    return jsonError(415, "Content-Type must be application/json");

  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) return jsonError(413, "Request body too large");

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return jsonError(400, "Request body is not valid JSON");
  }

  const parsed = missionSubmissionSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Invalid mission record", zodIssues(parsed.error));

  const problems = checkMissionPlausibility(parsed.data);
  if (problems.length > 0) {
    return jsonError(
      422,
      "Mission record is not physically plausible",
      problems.map((message) => ({ path: "(record)", message })),
    );
  }

  try {
    const mission = await createMission(parsed.data);
    return NextResponse.json({ mission }, { status: 201, ...noStore });
  } catch (err) {
    return databaseError(err);
  }
}
