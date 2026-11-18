"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Segmented, StatBar } from "@/components/ui/controls";
import { useRuntime } from "@/components/ui/RuntimeContext";
import { PAINTS } from "@/domain/config";
import type { MissionSummary } from "@/domain/mission";
import { modeQuery } from "@/lib/runtime";
import { CHECKPOINT_COUNT, formatMissionTime, MISSION_TIME_LIMIT_MS } from "@/sim/scoring";
import { ENGINE_IDS, ENGINE_PROFILES, type EngineId } from "@/sim/profiles";
import { configStore, useConfig } from "@/stores/configStore";
import { useFlight } from "@/stores/flightStore";
import { demoMissions } from "./demoData";
import { TelemetryCharts } from "./TelemetryCharts";
import {
  useHistory,
  useLeaderboard,
  useMissionDetail,
  type Loadable,
  type OutcomeFilter,
} from "./useMissionData";

function Card({
  title,
  index,
  aside,
  children,
  className = "",
  testId,
}: {
  title: string;
  index: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <section
      className={`panel flex min-w-0 flex-col p-4 md:p-5 ${className}`}
      aria-label={title}
      data-testid={testId}
    >
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-[family-name:var(--font-display)] text-[12px] uppercase tracking-[0.22em] text-steel-200">
          <span className="font-mono text-[10px] text-amber-500">{index}</span>
          {title}
        </h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

function DemoBadge() {
  return (
    <span
      className="border border-amber-500/60 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-amber-400"
      data-testid="demo-badge"
    >
      Demo data · deterministic sim
    </span>
  );
}

function LoadState<T>({
  data,
  empty,
  children,
  onRetry,
}: {
  data: Loadable<T>;
  empty: (d: T) => boolean;
  children: (d: T) => ReactNode;
  onRetry: () => void;
}) {
  if (data.state === "loading") {
    return (
      <div className="grid gap-2" role="status" aria-label="Loading">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-8 animate-pulse bg-graphite-800/80" />
        ))}
      </div>
    );
  }
  if (data.state === "error") {
    return (
      <div role="alert" className="border border-signal-red/40 bg-signal-red/5 p-4 text-[12px]">
        <div className="text-signal-red">{data.message}</div>
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 border border-graphite-600 px-3 py-1 text-steel-200 hover:border-ion-400"
        >
          Retry
        </button>
      </div>
    );
  }
  if (empty(data.data)) return null;
  return <>{children(data.data)}</>;
}

/** Instrument strip: the live (or last) simulation state. */
function LiveStrip() {
  const f = useFlight((s) => s);
  const items: [string, ReactNode, string?][] = [
    [
      "Sim status",
      <span
        key="s"
        data-testid="mc-status"
        className={
          f.status === "success"
            ? "text-signal-green"
            : f.status === "failed"
              ? "text-signal-red"
              : f.status === "paused"
                ? "text-amber-400"
                : "text-ion-300"
        }
      >
        {f.hasSession ? f.status.toUpperCase() : "NO SESSION"}
      </span>,
    ],
    [
      "Mission time",
      formatMissionTime(f.result?.durationMs ?? f.elapsedMs),
      `/ ${formatMissionTime(MISSION_TIME_LIMIT_MS)}`,
    ],
    ["Checkpoints", `${f.checkpoints} / ${CHECKPOINT_COUNT}`],
    ["Collisions", String(f.collisions)],
    ["Speed", f.speed.toFixed(1), "m/s"],
    ["Altitude", f.altitude.toFixed(1), "m"],
    ["Energy", f.energy.toFixed(0), "%"],
    ["Score", f.score.toLocaleString("en-US")],
  ];
  return (
    <div className="panel grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8" data-testid="live-strip">
      {items.map(([k, v, unit], i) => (
        <div key={k} className={`px-4 py-3 ${i ? "border-ion-400/10 xl:border-l" : ""}`}>
          <div className="label !text-[9px]">{k}</div>
          <div className="readout mt-1 text-xl leading-none text-steel-100">
            {v}
            {unit && <span className="ml-1 text-[10px] text-steel-400">{unit}</span>}
          </div>
          {k === "Energy" && (
            <div className="mt-1.5 h-1 bg-graphite-700">
              <div className="h-full bg-[#d27600]" style={{ width: `${f.energy}%` }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ConfigCard() {
  const paint = useConfig((s) => s.paint);
  const engine = useConfig((s) => s.engine);
  const lights = useConfig((s) => s.lights);
  const callsign = useConfig((s) => s.callsign);
  const p = ENGINE_PROFILES[engine];
  const paintScheme = PAINTS[paint];
  return (
    <Card title="Drone configuration" index="B" testId="config-card">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="h-10 w-10 shrink-0"
          style={{
            background: `linear-gradient(135deg, ${paintScheme.hull} 0 60%, ${paintScheme.accent} 60% 100%)`,
          }}
        />
        <div className="min-w-0">
          <div className="readout text-lg uppercase tracking-[0.1em] text-steel-100">
            AX-7 Kestrel
          </div>
          <div className="text-[11px] text-steel-400" data-testid="config-summary">
            {paintScheme.name} · {engine} · lights {lights ? "on" : "off"}
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-1.5">
        <StatBar label="Top speed" value={p.maxSpeed / 23} display={`${p.maxSpeed} m/s`} />
        <StatBar label="Thrust" value={p.accel / 32} display={`${p.accel} m/s²`} />
        <StatBar
          label="Power draw"
          value={p.throttleDrain / 1.5}
          display={`${p.throttleDrain}%/s`}
          tone="amber"
        />
      </div>
      <CallsignForm key={callsign} callsign={callsign} />
      <Link
        href="/hangar"
        className="mt-4 text-[11px] uppercase tracking-[0.16em] text-ion-300 underline-offset-4 hover:underline"
      >
        Reconfigure in hangar →
      </Link>
    </Card>
  );
}

/** Remounted (via key) when the stored callsign changes, so the draft resets without an effect. */
function CallsignForm({ callsign }: { callsign: string }) {
  const [draft, setDraft] = useState(callsign);
  const valid = /^[A-Za-z0-9 _-]{2,16}$/.test(draft.trim());
  return (
    <form
      className="mt-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) configStore.set({ callsign: draft.trim() });
      }}
    >
      <label htmlFor="callsign" className="label !text-[9px]">
        Pilot callsign (used for new records)
      </label>
      <div className="mt-1 flex gap-2">
        <input
          id="callsign"
          value={draft}
          maxLength={16}
          onChange={(e) => setDraft(e.target.value)}
          aria-invalid={!valid}
          className="min-w-0 flex-1 border border-graphite-600 bg-graphite-900 px-2.5 py-1.5 font-mono text-[12px] text-steel-100 outline-none focus:border-ion-400"
          data-testid="callsign-input"
        />
        <button
          type="submit"
          disabled={!valid || draft.trim() === callsign}
          className="border border-ion-400/50 px-3 text-[11px] uppercase tracking-[0.14em] text-ion-300 disabled:opacity-40"
        >
          Set
        </button>
      </div>
      {!valid && (
        <p className="mt-1 text-[11px] text-signal-red">2–16 letters, digits, space, _ or -</p>
      )}
    </form>
  );
}

function HistoryTable({
  rows,
  selected,
  onSelect,
}: {
  rows: MissionSummary[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="-mx-1 overflow-x-auto">
      <table
        className="w-full min-w-[560px] border-collapse text-left text-[12px]"
        data-testid="history-table"
      >
        <thead>
          <tr className="label !text-[9px]">
            <th className="px-2 py-1.5 font-normal">Pilot</th>
            <th className="px-2 py-1.5 font-normal">Result</th>
            <th className="px-2 py-1.5 font-normal">Engine</th>
            <th className="px-2 py-1.5 text-right font-normal">Time</th>
            <th className="px-2 py-1.5 text-right font-normal">Gates</th>
            <th className="px-2 py-1.5 text-right font-normal">Hits</th>
            <th className="px-2 py-1.5 text-right font-normal">Score</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => {
            const isSel = m.id === selected;
            return (
              <tr
                key={m.id}
                className={`border-t border-ion-400/8 ${isSel ? "bg-ion-400/10" : "hover:bg-graphite-800/70"}`}
                data-testid="history-row"
              >
                <td className="px-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => onSelect(m.id)}
                    aria-pressed={isSel}
                    className="text-left text-steel-100 underline-offset-2 hover:underline"
                  >
                    {m.callsign}
                  </button>
                  <div className="font-mono text-[10px] text-steel-400">
                    {new Date(m.createdAt).toISOString().slice(0, 16).replace("T", " ")}
                  </div>
                </td>
                <td className="px-2 py-1.5">
                  <span
                    className={`inline-flex items-center gap-1 ${m.outcome === "success" ? "text-signal-green" : "text-signal-red"}`}
                  >
                    <span aria-hidden="true">{m.outcome === "success" ? "✓" : "✕"}</span>
                    {m.outcome === "success" ? "Complete" : "Failed"}
                  </span>
                </td>
                <td className="px-2 py-1.5 font-mono text-steel-300">{m.engine}</td>
                <td className="readout px-2 py-1.5 text-right text-steel-200">
                  {formatMissionTime(m.durationMs)}
                </td>
                <td className="readout px-2 py-1.5 text-right text-steel-200">{m.checkpoints}/5</td>
                <td className="readout px-2 py-1.5 text-right text-steel-200">{m.collisions}</td>
                <td className="readout px-2 py-1.5 text-right text-amber-400">
                  {m.score.toLocaleString("en-US")}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Leaderboard({ demo, seed }: { demo: boolean; seed: number }) {
  const [engine, setEngine] = useState<EngineId | "ALL">("ALL");
  const { data, reload } = useLeaderboard(engine, demo, seed);
  return (
    <Card
      title="Leaderboard"
      index="E"
      testId="leaderboard"
      aside={demo ? <DemoBadge /> : undefined}
    >
      <Segmented<EngineId | "ALL">
        label="Leaderboard engine filter"
        value={engine}
        onChange={setEngine}
        options={[
          { value: "ALL", label: "All" },
          ...ENGINE_IDS.map((id) => ({ value: id, label: id })),
        ]}
      />
      <div className="mt-3">
        <LoadState data={data} empty={() => false} onRetry={reload}>
          {(rows) =>
            rows.length === 0 ? (
              <p
                className="py-6 text-center text-[12px] text-steel-400"
                data-testid="leaderboard-empty"
              >
                No completed missions yet. Clear all five gates to post a time.
              </p>
            ) : (
              <ol className="grid gap-1" data-testid="leaderboard-list">
                {rows.map((m, i) => (
                  <li
                    key={m.id}
                    className="grid grid-cols-[28px_1fr_auto_auto] items-center gap-3 border-b border-ion-400/8 py-1.5 text-[12px]"
                  >
                    <span
                      className={`readout text-center text-base ${i === 0 ? "text-amber-400" : "text-steel-400"}`}
                    >
                      {i + 1}
                    </span>
                    <span className="min-w-0 truncate text-steel-100">
                      {m.callsign}{" "}
                      <span className="font-mono text-[10px] text-steel-400">{m.engine}</span>
                    </span>
                    <span className="readout text-steel-300">
                      {formatMissionTime(m.durationMs)}
                    </span>
                    <span className="readout w-14 text-right text-amber-400">
                      {m.score.toLocaleString("en-US")}
                    </span>
                  </li>
                ))}
              </ol>
            )
          }
        </LoadState>
      </div>
    </Card>
  );
}

export function MissionControlView() {
  const mode = useRuntime();
  const demo = mode.benchmark;
  const [filter, setFilter] = useState<OutcomeFilter>("all");
  const [selected, setSelected] = useState<string | null>(() =>
    demo ? demoMissions(mode.seed)[0].id : null,
  );
  const history = useHistory(filter, demo, mode.seed);
  const detail = useMissionDetail(selected, demo, mode.seed);
  const live = useFlight((s) => s.telemetry);
  const liveSplits = useFlight((s) => s.splitsMs);
  const hasSession = useFlight((s) => s.hasSession);
  const [source, setSource] = useState<"live" | "record">(demo ? "record" : "live");

  // Readiness signal for automated capture (same contract as the 3D scenes).
  const ready =
    history.data.state !== "loading" &&
    (!selected || (detail !== null && detail.state !== "loading"));
  useEffect(() => {
    if (!ready) return;
    document.documentElement.dataset.sceneReady = "telemetry";
    return () => {
      if (document.documentElement.dataset.sceneReady === "telemetry")
        delete document.documentElement.dataset.sceneReady;
    };
  }, [ready]);

  const showRecord = source === "record" && detail?.state === "ready";
  const samples = showRecord ? detail.data.telemetry : live;
  const splits = showRecord ? detail.data.splitsMs : liveSplits;
  const chartTitle = showRecord
    ? `${detail.data.callsign} · ${detail.data.engine} · ${detail.data.outcome === "success" ? "complete" : "failed"} · ${formatMissionTime(detail.data.durationMs)}`
    : hasSession
      ? "Current flight session"
      : "Current flight session (none yet)";

  return (
    <div
      className="mx-auto grid w-full max-w-[1500px] gap-4 p-3 md:p-6"
      data-testid="mission-control"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="label !text-amber-500">Module 03</div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-light uppercase tracking-[0.14em] text-steel-100 md:text-4xl">
            Mission <span className="font-semibold">Control</span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {demo && <DemoBadge />}
          <Link
            href={`/flight${modeQuery(mode)}`}
            className="bg-ion-400 px-4 py-2 font-[family-name:var(--font-display)] text-[12px] font-semibold uppercase tracking-[0.2em] text-void"
          >
            Fly a mission →
          </Link>
        </div>
      </div>

      <LiveStrip />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card
          title="Telemetry"
          index="A"
          testId="telemetry-card"
          aside={
            <div className="flex items-center gap-2">
              <Segmented<"live" | "record">
                label="Telemetry source"
                value={source}
                onChange={setSource}
                options={[
                  { value: "live", label: "Live session" },
                  { value: "record", label: "Selected record" },
                ]}
              />
            </div>
          }
        >
          <div className="mb-2 text-[12px] text-steel-300" data-testid="chart-title">
            {chartTitle}
            {showRecord && demo && <span className="ml-2 text-amber-400">(demo)</span>}
          </div>
          {source === "record" && !selected ? (
            <TelemetryCharts
              samples={[]}
              splitsMs={[]}
              emptyLabel="Select a mission in the history table to inspect its recorded telemetry."
            />
          ) : source === "record" && detail?.state === "loading" ? (
            <div
              className="h-[330px] animate-pulse bg-graphite-800/60"
              role="status"
              aria-label="Loading telemetry"
            />
          ) : source === "record" && detail?.state === "error" ? (
            <div role="alert" className="text-[12px] text-signal-red">
              {detail.message}
            </div>
          ) : (
            <TelemetryCharts
              samples={samples}
              splitsMs={splits}
              durationS={showRecord ? detail.data.durationMs / 1000 : undefined}
              emptyLabel="Fly a mission in the Flight Test module — speed, altitude and energy are sampled at 10 Hz from the simulation."
            />
          )}
        </Card>
        <ConfigCard />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card
          title="Mission history"
          index="D"
          testId="history-card"
          aside={
            <div className="flex items-center gap-2">
              {demo && <DemoBadge />}
              <Segmented<OutcomeFilter>
                label="Filter missions by outcome"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: "All" },
                  { value: "success", label: "Complete" },
                  { value: "failed", label: "Failed" },
                ]}
              />
            </div>
          }
        >
          <LoadState data={history.data} empty={() => false} onRetry={history.reload}>
            {(d) =>
              d.missions.length === 0 ? (
                <div className="py-8 text-center" data-testid="history-empty">
                  <div className="label">No mission records</div>
                  <p className="mt-2 text-[12px] text-steel-400">
                    Completed and failed missions are saved automatically when a flight ends.
                  </p>
                </div>
              ) : (
                <>
                  <HistoryTable
                    rows={d.missions}
                    selected={selected}
                    onSelect={(id) => {
                      setSelected(id);
                      setSource("record");
                    }}
                  />
                  <div className="mt-2 font-mono text-[10px] text-steel-400">
                    Showing {d.missions.length} of {d.total} records
                  </div>
                </>
              )
            }
          </LoadState>
        </Card>
        <Leaderboard demo={demo} seed={mode.seed} />
      </div>
    </div>
  );
}
