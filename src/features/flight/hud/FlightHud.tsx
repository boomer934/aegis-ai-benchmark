"use client";

import Link from "next/link";
import { useState } from "react";
import { Kbd } from "@/components/ui/controls";
import { CHECKPOINT_COUNT, formatMissionTime, MISSION_TIME_LIMIT_MS } from "@/sim/scoring";
import { ENGINE_PROFILES } from "@/sim/profiles";
import { useFlight, useSaveState } from "@/stores/flightStore";

const STATUS_LABEL: Record<string, string> = {
  ready: "Ready",
  countdown: "Countdown",
  running: "In flight",
  paused: "Paused",
  success: "Mission complete",
  failed: "Mission failed",
};

export function StatusBar() {
  const status = useFlight((s) => s.status);
  const elapsed = useFlight((s) => s.elapsedMs);
  const checkpoints = useFlight((s) => s.checkpoints);
  const score = useFlight((s) => s.score);
  const collisions = useFlight((s) => s.collisions);
  const remaining = MISSION_TIME_LIMIT_MS - elapsed;
  const low = status === "running" && remaining < 10_000;
  return (
    <div
      className="panel flex items-stretch gap-4 px-4 py-2.5 md:gap-6 md:px-6"
      data-testid="mission-status-bar"
    >
      <div className="min-w-[96px]">
        <div className="label !text-[9px]">Status</div>
        <div
          className={`readout mt-0.5 text-[13px] uppercase tracking-[0.14em] ${
            status === "success"
              ? "text-signal-green"
              : status === "failed"
                ? "text-signal-red"
                : status === "paused"
                  ? "text-amber-400"
                  : "text-ion-300"
          }`}
          data-testid="mission-status"
          data-status={status}
        >
          {STATUS_LABEL[status]}
        </div>
      </div>
      <div>
        <div className="label !text-[9px]">Time left</div>
        <div
          className={`readout text-2xl leading-none md:text-[28px] ${low ? "text-signal-red" : "text-steel-100"}`}
          data-testid="mission-timer"
        >
          {formatMissionTime(remaining)}
        </div>
      </div>
      <div className="hidden sm:block">
        <div className="label !text-[9px]">Gates</div>
        <div
          className="mt-1.5 flex gap-1"
          aria-label={`${checkpoints} of ${CHECKPOINT_COUNT} gates cleared`}
          data-testid="mission-gates"
          data-value={checkpoints}
        >
          {Array.from({ length: CHECKPOINT_COUNT }, (_, i) => (
            <span
              key={i}
              className={`grid h-5 w-5 place-items-center font-mono text-[10px] ${
                i < checkpoints
                  ? "bg-signal-green text-void"
                  : i === checkpoints && status === "running"
                    ? "border border-ion-400 text-ion-300"
                    : "border border-graphite-600 text-steel-400"
              }`}
            >
              {i + 1}
            </span>
          ))}
        </div>
      </div>
      <div>
        <div className="label !text-[9px]">Score</div>
        <div className="readout text-xl leading-tight text-amber-400" data-testid="mission-score">
          {score.toLocaleString("en-US")}
        </div>
      </div>
      <div>
        <div className="label !text-[9px]">Hits</div>
        <div
          className={`readout text-xl leading-tight ${collisions ? "text-signal-red" : "text-steel-200"}`}
          data-testid="mission-collisions"
        >
          {collisions}
        </div>
      </div>
    </div>
  );
}

function Gauge({
  label,
  value,
  unit,
  pct,
  tone = "ion",
  testId,
}: {
  label: string;
  value: string;
  unit: string;
  pct: number;
  tone?: "ion" | "amber" | "red";
  testId?: string;
}) {
  const bar = tone === "ion" ? "bg-ion-400" : tone === "amber" ? "bg-amber-500" : "bg-signal-red";
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="label !text-[9px]">{label}</span>
        <span className="readout text-lg leading-none text-steel-100" data-testid={testId}>
          {value}
          <span className="ml-1 text-[10px] text-steel-400">{unit}</span>
        </span>
      </div>
      <div className="mt-1 h-1 bg-graphite-700">
        <div
          className={`h-full ${bar}`}
          style={{ width: `${Math.max(0, Math.min(100, pct * 100))}%` }}
        />
      </div>
    </div>
  );
}

export function TelemetryCluster() {
  const speed = useFlight((s) => s.speed);
  const alt = useFlight((s) => s.altitude);
  const vs = useFlight((s) => s.verticalSpeed);
  const energy = useFlight((s) => s.energy);
  const boosting = useFlight((s) => s.boosting);
  const engine = useFlight((s) => s.engine);
  const p = ENGINE_PROFILES[engine];
  return (
    <div className="panel grid w-[220px] gap-2.5 p-3.5" data-testid="telemetry-cluster">
      <div className="flex items-center justify-between">
        <span className="label !text-[9px] !text-ion-300">Flight data</span>
        <span className="font-mono text-[10px] text-amber-400">{engine}</span>
      </div>
      <Gauge
        label="Speed"
        value={speed.toFixed(1)}
        unit="m/s"
        pct={speed / (p.maxSpeed * p.boostMultiplier)}
        testId="hud-speed"
      />
      <Gauge
        label="Altitude"
        value={alt.toFixed(1)}
        unit="m"
        pct={alt / 32}
        testId="hud-altitude"
      />
      <Gauge
        label="Energy"
        value={energy.toFixed(0)}
        unit="%"
        pct={energy / 100}
        tone={energy < 20 ? "red" : "amber"}
        testId="hud-energy"
      />
      <div className="flex justify-between font-mono text-[10px] text-steel-400">
        <span>
          V/S {vs >= 0 ? "+" : ""}
          {vs.toFixed(1)}
        </span>
        <span className={boosting ? "text-amber-400" : ""}>
          {boosting ? "BOOST ACTIVE" : energy <= 0 ? "LIMP MODE" : "BOOST READY"}
        </span>
      </div>
    </div>
  );
}

export function ControlsHelp({ defaultOpen }: { defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="panel w-[250px] p-3" data-testid="controls-help">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between font-[family-name:var(--font-display)] text-[11px] uppercase tracking-[0.18em] text-steel-200"
      >
        Flight controls{" "}
        <span aria-hidden="true" className="font-mono text-[10px] text-steel-400">
          {open ? "−" : "+"}
        </span>
      </button>
      {open && (
        <dl className="mt-2.5 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5 text-[11px] text-steel-300">
          <dt className="flex gap-0.5">
            <Kbd>W</Kbd>
            <Kbd>A</Kbd>
            <Kbd>S</Kbd>
            <Kbd>D</Kbd>
          </dt>
          <dd>Move (arrows also work)</dd>
          <dt className="flex gap-0.5">
            <Kbd>Q</Kbd>
            <Kbd>E</Kbd>
          </dt>
          <dd>Descend / ascend</dd>
          <dt>
            <Kbd>Shift</Kbd>
          </dt>
          <dd>Boost (drains energy)</dd>
          <dt>
            <Kbd>Enter</Kbd>
          </dt>
          <dd>Start mission</dd>
          <dt>
            <Kbd>Space</Kbd>
          </dt>
          <dd>Pause / resume</dd>
          <dt>
            <Kbd>R</Kbd>
          </dt>
          <dd>Reset flight</dd>
        </dl>
      )}
    </div>
  );
}

/** Countdown numerals, pause overlay and transient checkpoint / collision callouts. */
export function CenterOverlay() {
  const status = useFlight((s) => s.status);
  const countdown = useFlight((s) => s.countdown);
  // Each flash is keyed by its timestamp; the CSS animation fades it out.
  const visibleFlash = useFlight((s) => s.flash);
  return (
    <div
      className="pointer-events-none absolute inset-0 grid place-items-center"
      aria-live="assertive"
    >
      {status === "countdown" && (
        <div
          key={Math.ceil(countdown)}
          className="readout animate-[flash_1s_ease-out_forwards] text-8xl font-light text-ion-300 drop-shadow-[0_0_30px_rgba(79,227,251,0.7)]"
          data-testid="countdown"
        >
          {Math.max(1, Math.ceil(countdown))}
        </div>
      )}
      {status === "paused" && (
        <div className="panel px-8 py-5 text-center" data-testid="paused-overlay">
          <div className="readout text-3xl uppercase tracking-[0.3em] text-amber-400">Paused</div>
          <div className="mt-2 text-[12px] text-steel-300">
            Press <Kbd>Space</Kbd> to resume · <Kbd>R</Kbd> to reset
          </div>
        </div>
      )}
      {visibleFlash && status === "running" && (
        <div
          key={visibleFlash.at}
          className={`readout absolute top-[26%] animate-[flash_1.1s_ease-out_forwards] px-4 py-1.5 text-lg uppercase tracking-[0.24em] ${
            visibleFlash.kind === "checkpoint"
              ? "bg-signal-green/15 text-signal-green"
              : visibleFlash.kind === "collision"
                ? "bg-signal-red/20 text-signal-red"
                : "bg-amber-500/15 text-amber-400"
          }`}
          data-testid={`flash-${visibleFlash.kind}`}
        >
          {visibleFlash.label}
        </div>
      )}
    </div>
  );
}

export function ResultDialog({
  onReplay,
  onRetrySave,
  controlHref,
}: {
  onReplay: () => void;
  onRetrySave: () => void;
  controlHref: string;
}) {
  const result = useFlight((s) => s.result);
  const status = useFlight((s) => s.status);
  const save = useSaveState();
  if (!result || (status !== "success" && status !== "failed")) return null;
  const ok = result.outcome === "success";
  const rows: [string, string][] = [
    ["Time", formatMissionTime(result.durationMs)],
    ["Gates", `${result.checkpoints} / ${CHECKPOINT_COUNT}`],
    ["Collisions", String(result.collisions)],
    ["Max speed", `${result.maxSpeed.toFixed(1)} m/s`],
    ["Avg speed", `${result.avgSpeed.toFixed(1)} m/s`],
    ["Energy used", `${result.energyUsed.toFixed(1)} %`],
  ];
  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-void/55 p-4 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="false"
        aria-labelledby="result-title"
        className="panel w-full max-w-[460px] p-6"
        data-testid="result-dialog"
        data-outcome={result.outcome}
      >
        <div className={`label ${ok ? "!text-signal-green" : "!text-signal-red"}`}>
          {ok ? "All gates cleared" : "Time limit reached"}
        </div>
        <h2
          id="result-title"
          className="mt-1 font-[family-name:var(--font-display)] text-3xl uppercase tracking-[0.12em] text-steel-100"
        >
          {ok ? "Mission complete" : "Mission failed"}
        </h2>
        <div className="mt-4 flex items-end justify-between border-y border-ion-400/10 py-3">
          <span className="label">Final score</span>
          <span className="readout text-4xl text-amber-400" data-testid="result-score">
            {result.score.toLocaleString("en-US")}
          </span>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-[12px]">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2">
              <dt className="text-steel-400">{k}</dt>
              <dd className="readout text-steel-100">{v}</dd>
            </div>
          ))}
        </dl>
        {result.splitsMs.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {result.splitsMs.map((t, i) => (
              <span
                key={i}
                className="border border-graphite-600 px-1.5 py-0.5 font-mono text-[10px] text-steel-300"
              >
                G{i + 1} {formatMissionTime(t)}
              </span>
            ))}
          </div>
        )}
        <div
          className="mt-4 text-[12px]"
          aria-live="polite"
          data-testid="save-status"
          data-state={save.kind}
        >
          {save.kind === "saving" && <span className="text-steel-300">Saving mission record…</span>}
          {save.kind === "saved" && (
            <span className="text-signal-green">Record saved to mission history.</span>
          )}
          {save.kind === "error" && (
            <span className="text-signal-red">
              Could not save: {save.message}{" "}
              <button type="button" onClick={onRetrySave} className="underline underline-offset-2">
                Retry
              </button>
            </span>
          )}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onReplay}
            className="bg-ion-400 px-4 py-2.5 font-[family-name:var(--font-display)] text-[12px] font-semibold uppercase tracking-[0.2em] text-void"
            data-testid="replay-button"
          >
            Replay <span className="font-mono text-[10px] opacity-70">(R)</span>
          </button>
          <Link
            href={controlHref}
            className="border border-ion-400/50 px-4 py-2.5 text-center font-[family-name:var(--font-display)] text-[12px] uppercase tracking-[0.2em] text-ion-300 hover:bg-ion-400/10"
          >
            Mission control
          </Link>
        </div>
      </div>
    </div>
  );
}
