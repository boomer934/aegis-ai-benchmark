import FacilityApp from "@/components/ui/FacilityApp";
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const q = await searchParams;
  const numericSeed = Number(q.seed ?? 42);
  return (
    <FacilityApp
      options={{
        scene: q.scene === "flight" || q.scene === "telemetry" ? q.scene : "hangar",
        camera: q.camera === "top" || q.camera === "side" ? q.camera : "hero",
        benchmark: q.benchmark === "1",
        perf: q.perf === "1",
        seed: Number.isFinite(numericSeed) ? numericSeed >>> 0 : 42,
      }}
    />
  );
}
