"use client";

import { useEffect, useState } from "react";
import { summarizePerf, type PerfSummary } from "@/stores/perfStore";

const fmt = (v: number | null, digits = 1) => (v === null ? "—" : v.toFixed(digits));
const compact = (v: number) =>
  v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(1)}k` : String(v);

/**
 * Developer performance panel. Reads real samples from the PerfProbe ring
 * buffer (last 600 frames) twice per second; it never estimates values.
 */
export function PerfPanel() {
  const [s, setS] = useState<PerfSummary | null>(null);
  useEffect(() => {
    const id = window.setInterval(() => setS(summarizePerf()), 500);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div
      className="panel-flat pointer-events-none absolute bottom-3 right-3 z-20 w-[220px] p-3 font-mono text-[10px] text-steel-300 lg:bottom-6 lg:left-auto lg:right-[400px]"
      data-testid="perf-panel"
      aria-label="Performance statistics"
    >
      <div className="mb-1.5 flex justify-between">
        <span className="label !text-[9px] !text-ion-300">Perf · {s?.scene ?? "…"}</span>
        <span className="text-amber-400">{s?.quality ?? ""}</span>
      </div>
      {s ? (
        <dl className="grid grid-cols-2 gap-x-2 gap-y-0.5">
          <dt>FPS (median)</dt>
          <dd className="text-right text-steel-100" data-testid="perf-fps">
            {fmt(s.fpsMedian, 0)}
          </dd>
          <dt>FPS (p5)</dt>
          <dd className="text-right">{fmt(s.fpsP5, 0)}</dd>
          <dt>Frame p50</dt>
          <dd className="text-right">{fmt(s.frameMsMedian)} ms</dd>
          <dt>Frame p95</dt>
          <dd className="text-right">{fmt(s.frameMsP95)} ms</dd>
          <dt>Frame p99</dt>
          <dd className="text-right">{fmt(s.frameMsP99)} ms</dd>
          <dt>Draw calls</dt>
          <dd className="text-right text-steel-100" data-testid="perf-calls">
            {s.drawCalls}
          </dd>
          <dt>Triangles</dt>
          <dd className="text-right">{compact(s.triangles)}</dd>
          <dt>Geo / Tex</dt>
          <dd className="text-right">
            {s.geometries} / {s.textures}
          </dd>
          <dt>DPR</dt>
          <dd className="text-right">{s.dpr}</dd>
          <dt>Samples</dt>
          <dd className="text-right">{s.samples}</dd>
        </dl>
      ) : (
        <div>Sampling…</div>
      )}
      <div className="mt-1.5 truncate text-[9px] text-steel-400" title={s?.renderer}>
        {s?.renderer}
      </div>
    </div>
  );
}
