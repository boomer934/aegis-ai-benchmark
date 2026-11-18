import { NextResponse, type NextRequest } from "next/server";
import { databaseError, jsonError, noStore, zodIssues } from "@/lib/server/http";
import { leaderboard } from "@/lib/server/missions";
import { leaderboardQuerySchema } from "@/lib/validation/mission";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const parsed = leaderboardQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return jsonError(400, "Invalid query parameters", zodIssues(parsed.error));
  try {
    const entries = await leaderboard(parsed.data);
    return NextResponse.json({ entries }, noStore);
  } catch (err) {
    return databaseError(err);
  }
}
