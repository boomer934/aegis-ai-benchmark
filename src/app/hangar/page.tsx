import type { Metadata } from "next";
import { AppShell } from "@/components/ui/AppShell";
import { HangarView } from "@/features/hangar/HangarView";
import { parseRuntimeMode, type SearchParams } from "@/lib/runtime";

export const metadata: Metadata = { title: "Hangar · AEGIS Drone Test Facility" };

export default async function HangarPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const mode = parseRuntimeMode(await searchParams);
  return (
    <AppShell mode={mode} active="hangar">
      <HangarView />
    </AppShell>
  );
}
