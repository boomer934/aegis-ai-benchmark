import { Simulator, type Options } from "@/components/ui/simulator";

type Search = Record<string, string | string[] | undefined>;

export default async function Page({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const parsed = typeof params.seed === "string" ? Number(params.seed) : 42;
  const options: Options = {
    module: params.scene === "flight" || params.scene === "telemetry" ? params.scene : "hangar",
    camera: params.camera === "top" ? "Top" : params.camera === "side" ? "Side" : "Hero",
    benchmark: params.benchmark === "1",
    perf: params.perf === "1",
    seed: Number.isInteger(parsed) ? parsed >>> 0 : 42,
  };
  return <Simulator initial={options} />;
}
