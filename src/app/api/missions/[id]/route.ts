import { NextResponse } from "next/server";
import { databaseError, jsonError, noStore } from "@/lib/server/http";
import { getMission } from "@/lib/server/missions";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[a-z0-9]{8,40}$/i.test(id)) return jsonError(400, "Invalid mission id");
  try {
    const mission = await getMission(id);
    if (!mission) return jsonError(404, "Mission not found");
    return NextResponse.json({ mission }, noStore);
  } catch (err) {
    return databaseError(err);
  }
}
