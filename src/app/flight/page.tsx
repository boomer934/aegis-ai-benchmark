import type { Metadata } from "next";
import { AppShell } from "@/components/ui/AppShell";
import { FlightView } from "@/features/flight/FlightView";
import { parseRuntimeMode, type SearchParams } from "@/lib/runtime";

export const metadata: Metadata = { title: "Flight Test · AEGIS Drone Test Facility" };

export default async function FlightPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const mode = parseRuntimeMode(await searchParams);
  return (
    <AppShell mode={mode} active="flight">
      <FlightView />
    </AppShell>
  );
}
