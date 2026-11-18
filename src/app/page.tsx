import { redirect } from "next/navigation";
import type { SearchParams } from "@/lib/runtime";

/**
 * Entry point. Routes `?scene=` benchmark URLs to their module while keeping
 * every query parameter, e.g. /?benchmark=1&seed=42&scene=flight&camera=chase.
 */
export default async function Home({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "string") query.set(k, v);
    else if (Array.isArray(v) && v[0] !== undefined) query.set(k, v[0]);
  }
  const scene = query.get("scene");
  const path = scene === "flight" ? "/flight" : scene === "telemetry" ? "/control" : "/hangar";
  const qs = query.toString();
  redirect(qs ? `${path}?${qs}` : path);
}
