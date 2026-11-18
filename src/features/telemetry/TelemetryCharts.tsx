"use client";

import { useId, useMemo, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { TelemetrySample } from "@/sim/mission";

/**
 * Telemetry as small multiples: speed, altitude and energy each get their own
 * chart (one y-scale each — no dual axes) sharing the time axis and a
 * synchronised crosshair + tooltip. Keyboard: focus a chart, use ←/→.
 * Palette validated against the dark surface (dataviz validator, all checks pass).
 */
export const SERIES = [
  { key: 1, id: "speed", label: "Speed", unit: "m/s", color: "#10a3c0", fixedMax: null as number | null, digits: 1 },
  { key: 2, id: "altitude", label: "Altitude", unit: "m", color: "#1fae73", fixedMax: null as number | null, digits: 1 },
  { key: 3, id: "energy", label: "Energy", unit: "%", color: "#d27600", fixedMax: 100 as number | null, digits: 0 },
] as const;

const W = 640;
const H = 96;
const PAD = { l: 40, r: 10, t: 8, b: 6 };

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const step = v > 20 ? 10 : v > 8 ? 5 : 2;
  return Math.ceil((v * 1.1) / step) * step;
}

export function TelemetryCharts({
  samples,
  splitsMs,
  durationS,
  emptyLabel,
}: {
  samples: TelemetrySample[];
  splitsMs: number[];
  durationS?: number;
  emptyLabel: string;
}) {
  const [cursor, setCursor] = useState<number | null>(null);
  const uid = useId();
  const tMax = Math.max(durationS ?? 0, samples.at(-1)?.[0] ?? 0, 1);
  const x = (t: number) => PAD.l + (t / tMax) * (W - PAD.l - PAD.r);

  const series = useMemo(
    () =>
      SERIES.map((s) => {
        const max = s.fixedMax ?? niceMax(Math.max(...samples.map((p) => p[s.key]), 1));
        const y = (v: number) => PAD.t + (1 - v / max) * (H - PAD.t - PAD.b);
        const d = samples.map((p, i) => `${i ? "L" : "M"}${x(p[0]).toFixed(1)},${y(p[s.key]).toFixed(1)}`).join("");
        return { ...s, max, y, d };
      }),
    // x depends on tMax only
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [samples, tMax],
  );

  if (samples.length < 2) {
    return (
      <div className="grid h-[330px] place-items-center border border-dashed border-graphite-600 text-center" data-testid="telemetry-empty">
        <div>
          <div className="label">No telemetry</div>
          <p className="mt-2 max-w-xs text-[12px] text-steel-400">{emptyLabel}</p>
        </div>
      </div>
    );
  }

  const indexAt = (clientX: number, el: SVGSVGElement) => {
    const r = el.getBoundingClientRect();
    const t = ((clientX - r.left) / r.width * W - PAD.l) / (W - PAD.l - PAD.r) * tMax;
    let best = 0;
    for (let i = 1; i < samples.length; i++) if (Math.abs(samples[i][0] - t) < Math.abs(samples[best][0] - t)) best = i;
    return best;
  };
  const onMove = (e: PointerEvent<SVGSVGElement>) => setCursor(indexAt(e.clientX, e.currentTarget));
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      setCursor((c) => Math.max(0, Math.min(samples.length - 1, (c ?? 0) + (e.key === "ArrowRight" ? step : -step))));
    } else if (e.key === "Escape") setCursor(null);
  };
  const cur = cursor !== null ? samples[cursor] : null;

  return (
    <div className="relative" data-testid="telemetry-charts" onPointerLeave={() => setCursor(null)}>
      {series.map((s, si) => (
        <figure key={s.id} className="relative">
          <figcaption className="mb-0.5 flex items-baseline justify-between">
            <span className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-steel-300">
              <span aria-hidden="true" className="h-0.5 w-3" style={{ background: s.color }} />
              {s.label} <span className="normal-case tracking-normal text-steel-400">({s.unit})</span>
            </span>
            <span className="readout text-[13px] text-steel-100">
              {cur ? `${cur[s.key].toFixed(s.digits)} ${s.unit}` : `max ${Math.max(...samples.map((p) => p[s.key])).toFixed(s.digits)}`}
            </span>
          </figcaption>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-[84px] w-full touch-none overflow-visible outline-none focus-visible:outline-2 focus-visible:outline-ion-400"
            preserveAspectRatio="none"
            role="img"
            tabIndex={0}
            aria-label={`${s.label} over ${tMax.toFixed(1)} seconds. Use left and right arrow keys to inspect samples.`}
            aria-describedby={`${uid}-readout`}
            onPointerMove={onMove}
            onPointerDown={onMove}
            onKeyDown={onKey}
            onFocus={() => setCursor((c) => c ?? 0)}
            data-testid={`chart-${s.id}`}
          >
            {[0, 0.5, 1].map((f) => (
              <line key={f} x1={PAD.l} x2={W - PAD.r} y1={s.y(s.max * f)} y2={s.y(s.max * f)} stroke="rgba(143,241,255,0.07)" vectorEffect="non-scaling-stroke" />
            ))}
            {splitsMs.map((ms) => (
              <line key={ms} x1={x(ms / 1000)} x2={x(ms / 1000)} y1={PAD.t} y2={H - PAD.b} stroke="rgba(201,212,219,0.22)" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
            ))}
            <path d={s.d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            {cur && (
              <g>
                <line x1={x(cur[0])} x2={x(cur[0])} y1={PAD.t} y2={H - PAD.b} stroke="#c9d4db" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                <circle cx={x(cur[0])} cy={s.y(cur[s.key])} r={4} fill={s.color} stroke="#0d1117" strokeWidth={2} vectorEffect="non-scaling-stroke" />
              </g>
            )}
          </svg>
          {/* Labels in HTML so they are not distorted by the stretched viewBox. */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-[84px] font-mono text-[9px] text-steel-400">
            {[0, 0.5, 1].map((f) => (
              <span key={f} className="absolute left-0 w-[5.2%] -translate-y-1/2 text-right" style={{ top: `${(s.y(s.max * f) / H) * 100}%` }}>
                {Math.round(s.max * f)}
              </span>
            ))}
            {si === 0 &&
              splitsMs.map((ms, i) => (
                <span key={ms} className="absolute top-0 pl-1 text-steel-300" style={{ left: `${(x(ms / 1000) / W) * 100}%` }}>
                  G{i + 1}
                </span>
              ))}
          </div>
        </figure>
      ))}
      <div className="mt-1 flex justify-between pl-[6%] font-mono text-[10px] text-steel-400">
        <span>0 s</span>
        <span>{(tMax / 2).toFixed(0)} s</span>
        <span>{tMax.toFixed(1)} s</span>
      </div>
      <div id={`${uid}-readout`} className="sr-only" aria-live="polite">
        {cur ? `t ${cur[0].toFixed(1)} s: speed ${cur[1].toFixed(1)} m/s, altitude ${cur[2].toFixed(1)} m, energy ${cur[3].toFixed(0)} %` : ""}
      </div>
      {cur && (
        <div
          className="panel-flat pointer-events-none absolute right-0 top-0 px-2.5 py-1.5 font-mono text-[10px] text-steel-200"
          data-testid="chart-tooltip"
        >
          t = {cur[0].toFixed(1)} s
        </div>
      )}
    </div>
  );
}
