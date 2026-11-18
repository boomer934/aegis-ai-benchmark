import { useState } from "react";
import { formatTime } from "../flight/flight-panel";
import type { Sample } from "../flight/physics";

const channels = {
  speed: { label: "Speed", unit: "m/s", max: 26, color: "#87e8d6" },
  altitude: { label: "Altitude", unit: "m", max: 20, color: "#eeb482" },
  energy: { label: "Energy", unit: "%", max: 100, color: "#b6e887" },
} as const;
type Channel = keyof typeof channels;
const keys = Object.keys(channels) as Channel[];
const width = 840;
const height = 228;

export function Trace({ samples, label }: { samples: Sample[]; label: string }) {
  const [channel, setChannel] = useState<Channel>("speed");
  const [point, setPoint] = useState<number | null>(null);
  const series = channels[channel];
  const last = samples.at(-1);
  const total = Math.max(1, last?.time ?? 0);
  const index = Math.min(point ?? samples.length - 1, samples.length - 1);
  const selected = samples[index];
  const x = (t: number) => (t / total) * width;
  const y = (n: number) => height - (n / series.max) * (height - 6);
  const line = samples
    .map((s, i) => `${i === 0 ? "M" : "L"}${x(s.time).toFixed(2)} ${y(s[channel]).toFixed(2)}`)
    .join(" ");
  const units = Array.from({ length: 5 }, (_, i) => series.max * (1 - i / 4));
  if (samples.length < 2)
    return (
      <section className="trace-shell" aria-label="Telemetry trace">
        <div className="trace-header">
          <div>
            <h2>Flight trace</h2>
            <span>{label}</span>
          </div>
        </div>
        <div className="empty-trace">
          <p>Waiting for telemetry</p>
          <span>Start a trial or select a recorded run to inspect its flight data.</span>
        </div>
      </section>
    );

  return (
    <section className="trace-shell" aria-label="Telemetry trace">
      <div className="trace-header">
        <div>
          <h2>Flight trace</h2>
          <span>{label}</span>
        </div>
        <div className="segmented trace-tabs" role="group" aria-label="Telemetry channel">
          {keys.map((metric) => (
            <button
              key={metric}
              type="button"
              aria-pressed={channel === metric}
              onClick={() => setChannel(metric)}
            >
              {channels[metric].label}
            </button>
          ))}
        </div>
      </div>
      <div className="chart-meta">
        <span>
          <i style={{ background: series.color }} /> {series.label} <small>· {series.unit}</small>
        </span>
        <output data-testid="trace-value">
          <b>{selected[channel].toFixed(1)}</b> {series.unit}{" "}
          <small>@ {formatTime(selected.time, 2)}</small>
        </output>
      </div>
      <div className="chart-grid">
        <div className="y-axis">
          {units.map((n) => (
            <span key={n}>{n.toLocaleString("en-US", { maximumFractionDigits: 1 })}</span>
          ))}
        </div>
        <svg
          className="trace-svg"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`${series.label} over ${total.toFixed(1)} seconds`}
          onPointerMove={(event) => {
            if (event.pointerType === "touch" && event.buttons === 0) return;
            const rect = event.currentTarget.getBoundingClientRect();
            const t = ((event.clientX - rect.left) / rect.width) * total;
            const closest = samples.reduce(
              (best, s, i) => (Math.abs(s.time - t) < Math.abs(samples[best].time - t) ? i : best),
              0,
            );
            setPoint(closest);
          }}
        >
          <defs>
            <linearGradient
              id="trace-area"
              x1="0"
              x2="0"
              y1="0"
              y2="1"
              gradientUnits="objectBoundingBox"
            >
              <stop stopColor={series.color} stopOpacity=".29" />
              <stop offset="1" stopColor={series.color} stopOpacity=".025" />
            </linearGradient>
          </defs>
          {units.map((_, i) => (
            <path
              key={i}
              d={`M0 ${(i * height) / 4}H${width}`}
              stroke="#283539"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <path
              key={i}
              d={`M${(i * width) / 8} 0V${height}`}
              stroke="#243237"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <path d={`${line} L${x(last?.time ?? 0)} ${height}H0Z`} fill="url(#trace-area)" />
          <path
            d={line}
            fill="none"
            stroke={series.color}
            strokeWidth="1.9"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={`M${x(selected.time)} 0V${height}`}
            stroke="#9dbbb6"
            strokeDasharray="4 5"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
          <circle cx={x(selected.time)} cy={y(selected[channel])} r="3.6" fill={series.color} />
        </svg>
        <div className="x-axis">
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <span key={t}>{formatTime(t * total, 0)}</span>
          ))}
        </div>
      </div>
      <label className="chart-scrubber">
        Sample position
        <input
          type="range"
          style={{ caretColor: "transparent" }}
          min="0"
          max={samples.length - 1}
          value={index}
          onChange={(e) => setPoint(Number(e.target.value))}
          aria-valuetext={`${selected.time.toFixed(2)} seconds, ${selected[channel].toFixed(1)} ${series.unit}`}
        />
      </label>
    </section>
  );
}
