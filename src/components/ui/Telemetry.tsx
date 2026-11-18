import { useEffect, useMemo, useState } from "react";
import { useFacility, readSample, type Facility, type Sample } from "@/stores/facility";
import { referenceFlight } from "@/features/telemetry/demo";
import type { History, RecordRow } from "@/lib/results";
import { Icon } from "./Marks";
const channels = {
  speed: ["Velocity", "m/s"],
  altitude: ["Altitude", "m"],
  battery: ["Energy", "%"],
} as const;
type Channel = keyof typeof channels;
function Trace({ samples }: { samples: Sample[] }) {
  const [channel, setChannel] = useState<Channel>("speed"),
    [cursor, setCursor] = useState<number | null>(null);
  const current = cursor === null ? samples.length - 1 : Math.min(cursor, samples.length - 1);
  const active = samples[current],
    max = Math.max(
      channel === "battery" ? 100 : 5,
      Math.ceil(Math.max(...samples.map((p) => p[channel]), 0) / 2) * 2,
    );
  const end = Math.max(1, samples.at(-1)?.t ?? 1),
    left = 43,
    right = 756,
    top = 16,
    bottom = 177;
  const x = (v: number) => left + (v / end) * (right - left),
    y = (v: number) => bottom - (v / max) * (bottom - top);
  const path = samples
    .map((p, i) => (i ? "L" : "M") + x(p.t).toFixed(2) + "," + y(p[channel]).toFixed(2))
    .join(" ");
  return (
    <section className="panel trace-panel">
      <div className="panel-heading">
        <Icon name="wave" />
        <h2>Flight recorder</h2>
        <span className="panel-extra">Time series</span>
      </div>
      <div className="trace-tools">
        <div className="segments">
          {(Object.keys(channels) as Channel[]).map((key) => (
            <button key={key} aria-pressed={key === channel} onClick={() => setChannel(key)}>
              {channels[key][0]}
            </button>
          ))}
        </div>
        <b>
          {active ? active[channel].toFixed(1) : "—"} <small>{channels[channel][1]}</small>
        </b>
      </div>
      <div className="chart-wrap">
        <svg
          aria-label={channels[channel][0] + " flight trace"}
          viewBox="0 0 780 210"
          onPointerMove={(e) => {
            if (!samples.length) return;
            const rect = e.currentTarget.getBoundingClientRect(),
              time = Math.max(
                0,
                Math.min(
                  end,
                  ((((e.clientX - rect.left) / rect.width) * 780 - left) / (right - left)) * end,
                ),
              );
            let closest = 0;
            for (let i = 1; i < samples.length; i++)
              if (Math.abs(samples[i].t - time) < Math.abs(samples[closest].t - time)) closest = i;
            setCursor(closest);
          }}
        >
          <defs>
            <linearGradient id="trace-fill" x1="0" x2="0" y1="0" y2="1">
              <stop stopColor="#79d8d5" stopOpacity=".27" />
              <stop offset="1" stopColor="#79d8d5" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3, 4].map((v) => (
            <g key={v}>
              <line
                className="chart-grid"
                x1={left}
                x2={right}
                y1={y((v * max) / 4)}
                y2={y((v * max) / 4)}
              />
              <text x={left - 10} y={y((v * max) / 4) + 4} textAnchor="end">
                {((v * max) / 4).toFixed(1)}
              </text>
            </g>
          ))}
          {[0, 1, 2, 3, 4, 5, 6].map((v) => (
            <g key={v}>
              <line
                className="chart-grid"
                x1={x((v * end) / 6)}
                x2={x((v * end) / 6)}
                y1={top}
                y2={bottom}
              />
              <text x={x((v * end) / 6)} y={bottom + 22} textAnchor="middle">
                {((v * end) / 6).toFixed(0)}s
              </text>
            </g>
          ))}
          {active && (
            <>
              <path
                d={path + " L" + right + "," + bottom + " L" + left + "," + bottom + " Z"}
                fill="url(#trace-fill)"
              />
              <path d={path} fill="none" stroke="#80d7d4" strokeWidth="2.5" />
              <line
                x1={x(active.t)}
                x2={x(active.t)}
                y1={top}
                y2={bottom}
                stroke="#ed9c59"
                strokeDasharray="3 4"
              />
              <circle cx={x(active.t)} cy={y(active[channel])} r="4" fill="#ffb776" />
            </>
          )}
        </svg>
        {!samples.length && <p className="chart-empty">Start a flight to record telemetry.</p>}
      </div>
      {samples.length > 0 && (
        <label className="scrub">
          Sample at {active.t.toFixed(2)} s
          <input
            type="range"
            min={0}
            max={samples.length - 1}
            value={current}
            onChange={(e) => setCursor(+e.target.value)}
            aria-label="Inspect telemetry sample"
          />
        </label>
      )}
    </section>
  );
}
function Archive({
  data,
  loading,
  error,
  reload,
}: {
  data: History | null;
  loading: boolean;
  error: boolean;
  reload: () => void;
}) {
  const [tab, setTab] = useState<"recent" | "leaders">("recent");
  return (
    <section className="panel archive">
      <div className="panel-heading">
        <Icon name="grid" />
        <h2>Mission archive</h2>
        <div className="segments">
          {(["recent", "leaders"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} aria-pressed={tab === t}>
              {t === "recent" ? "History" : "Leaderboard"}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <p className="empty">Reading local archive…</p>
      ) : error ? (
        <p className="empty">
          Archive unavailable. <button onClick={reload}>Retry</button>
        </p>
      ) : !data?.[tab].length ? (
        <p className="empty">No missions recorded. Finish a circuit to add the first result.</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {[
                  tab === "leaders" ? "Rank" : "Flight",
                  "Profile",
                  "Outcome",
                  "Time",
                  "Gates",
                  "Hits",
                  "Score",
                ].map((t) => (
                  <th key={t}>{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data[tab].map((r: RecordRow, i) => (
                <tr key={r.id}>
                  <td>
                    {tab === "leaders"
                      ? "#" + (i + 1)
                      : r.id.startsWith("reference")
                        ? "REF–0" + (i + 1)
                        : r.id.slice(0, 8).toUpperCase()}
                    {tab === "recent" && !r.id.startsWith("reference") && (
                      <time className="archive-date" dateTime={r.createdAt}>
                        {new Date(r.createdAt).toISOString().slice(0, 16).replace("T", " ")} UTC
                      </time>
                    )}
                  </td>
                  <td>{r.profile}</td>
                  <td>{r.outcome}</td>
                  <td>{(r.durationMs / 1000).toFixed(2)} s</td>
                  <td>{r.gates}/5</td>
                  <td>{r.collisions}</td>
                  <td>{r.score.toLocaleString("en-US")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
export default function Telemetry({ s }: { s: Facility }) {
  useFacility(s);
  const demo = s.options.benchmark;
  const refs = useMemo(
    () => (demo ? (["SPORT", "ECO", "RACE"] as const).map(referenceFlight) : []),
    [demo],
  );
  const [history, setHistory] = useState<History | null>(null),
    [error, setError] = useState(false),
    [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(-1);
  useEffect(() => {
    if (demo) return;
    const controller = new AbortController();
    fetch("/api/missions", { signal: controller.signal, cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw Error();
        const result: History = await r.json();
        setHistory(result);
        setError(false);
        setLoaded(attempt);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError(true);
          setLoaded(attempt);
        }
      });
    return () => controller.abort();
  }, [demo, attempt, s.saveStatus]);
  const f = demo ? refs[0].f : s.sim.state,
    values = readSample(f),
    samples = demo ? refs[0].samples : s.samples;
  const data = demo
    ? {
        recent: refs.map((r) => r.row),
        leaders: refs.map((r) => r.row).sort((a, b) => b.score - a.score),
      }
    : history;
  return (
    <div className="telemetry">
      <div className="telemetry-metrics">
        {[
          ["Velocity", values.speed.toFixed(1), "m/s"],
          ["Altitude", values.altitude.toFixed(1), "m"],
          ["Energy", values.battery.toFixed(0), "%"],
          ["Flight time", f.elapsed.toFixed(2), "s"],
        ].map(([label, value, unit]) => (
          <div key={label}>
            <span className="label">{label}</span>
            <strong>
              {value}
              <small>{unit}</small>
            </strong>
          </div>
        ))}
      </div>
      <div className="tele-grid">
        <Trace samples={samples} />
        <aside className="panel">
          <div className="panel-heading">
            <Icon name="chip" />
            <h2>Flight summary</h2>
          </div>
          <div className="tele-id">
            <Icon name="flight" size={22} />
            <b>Kestrel X4</b>
            <span>AX–04 / {demo ? "Demo flight" : s.settings.paint}</span>
          </div>
          <div className="mission-readout">
            <span>Finish / engine</span>
            <b>
              {demo ? "Signal" : s.settings.paint} / {demo ? "SPORT" : s.settings.profile}
            </b>
            <span>Navigation lights</span>
            <b>{s.settings.lights ? "On" : "Off"}</b>
            <span>Status</span>
            <b>{f.phase}</b>
            <span>Checkpoints</span>
            <b>{f.gates} / 5</b>
            <span>Collisions</span>
            <b>{f.collisions}</b>
          </div>
        </aside>
      </div>
      {s.saveStatus === "error" && !demo && (
        <button className="reset" onClick={() => void s.save()}>
          Unsaved flight · Retry archive
        </button>
      )}
      <Archive
        data={data}
        loading={!demo && loaded !== attempt}
        error={error}
        reload={() => setAttempt((a) => a + 1)}
      />
    </div>
  );
}
