import type { Metadata } from "next";
import { AppShell } from "@/components/ui/AppShell";
import { MissionControlView } from "@/features/telemetry/MissionControlView";
import { parseRuntimeMode, type SearchParams } from "@/lib/runtime";

export const metadata: Metadata = { title: "Mission Control · AEGIS Drone Test Facility" };

export default async function ControlPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const mode = parseRuntimeMode(await searchParams);
  return (
    <AppShell mode={mode} active="control">
      <MissionControlView />
    </AppShell>
  );
}
