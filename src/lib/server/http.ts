import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import type { ApiError } from "@/domain/mission";

export function jsonError(status: number, error: string, issues?: ApiError["issues"]): NextResponse<ApiError> {
  return NextResponse.json<ApiError>(issues ? { error, issues } : { error }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function zodIssues(err: ZodError): NonNullable<ApiError["issues"]> {
  return err.issues.map((i) => ({ path: i.path.join(".") || "(root)", message: i.message }));
}

/** Log the real cause server-side, return a generic message to the client. */
export function databaseError(err: unknown): NextResponse<ApiError> {
  console.error("[aegis] database error:", err);
  return jsonError(503, "Mission database is unavailable. Run `npm run db:setup` and retry.");
}

export const noStore = { headers: { "Cache-Control": "no-store" } } as const;
