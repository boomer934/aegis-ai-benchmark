import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";
import type { SaveState } from "@/components/ui/simulator";
import type { FlightSnapshot } from "../flight/engine";
import { formatTime, PHASE_LABEL } from "../flight/flight-panel";
import { PAINTS, speedOf, type Configuration } from "../flight/physics";
import type { MissionLog, MissionRecord, ResultInput } from "./validation";
import { DEMO } from "./demo";
import { Trace } from "./trace";

const date = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function MissionControl({
  config,
  flight,
  frozen,
  saveState,
  retrySave,
  fly,
}: {
  config: Configuration;
  flight: FlightSnapshot;
  frozen: boolean;
  saveState: SaveState;
  retrySave: (result: ResultInput) => void;
  fly: () => void;
}) {
  const [log, setLog] = useState<MissionLog | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [chosen, setChosen] = useState<MissionRecord | null>(null);
  const [showLeaders, setShowLeaders] = useState(false);
  useEffect(() => {
    if (frozen) return;
    const abort = new AbortController();
    async function fetchLog() {
      try {
        const response = await fetch("/api/missions", {
          cache: "no-store",
          signal: AbortSignal.any([abort.signal, AbortSignal.timeout(8000)]),
        });
        if (!response.ok) throw new Error("Log request failed");
        setLog(await response.json());
        setError(false);
      } catch {
        if (!abort.signal.aborted) setError(true);
      }
    }
    void fetchLog();
    return () => abort.abort();
  }, [attempt, frozen, saveState?.phase]);

  const archive = frozen ? DEMO : log;
  const record = chosen ?? (frozen || flight.samples.length < 2 ? archive?.history[0] : null);
  const samples = record?.samples ?? flight.samples;
  const last = record?.samples.at(-1);
  const speed = last?.speed ?? speedOf(flight);
  const altitude = last?.altitude ?? flight.position[1];
  const energy = record?.energy ?? flight.energy;
  const score = record?.score ?? flight.result?.score;
  const phase = record
    ? record.outcome === "success"
      ? "Course complete"
      : "Time expired"
    : PHASE_LABEL[flight.phase];
  const elapsed = record ? record.durationMs / 1000 : flight.elapsed;
  const source = record ? (frozen ? "Demonstration run" : "Recorded run") : "Current session";
  const metrics = [
    { name: "Velocity", value: speed.toFixed(1), unit: "m/s" },
    { name: "Altitude", value: altitude.toFixed(1), unit: "m" },
    { name: "Energy", value: energy.toFixed(0), unit: "%" },
    { name: "Duration", value: formatTime(elapsed, 2), unit: "" },
    { name: "Gates cleared", value: record?.checkpoints ?? flight.checkpoints, unit: "/ 5" },
    { name: "Collisions", value: record?.collisions ?? flight.collisions, unit: "" },
  ];
  const rows = showLeaders ? archive?.leaderboard : archive?.history;
  const errorRun =
    saveState?.phase === "error" && flight.result?.id === saveState.id ? flight.result : null;

  return (
    <div className="telemetry-stack">
      {frozen && (
        <p className="demo-banner">
          <i className="led" /> DEMO DATA{" "}
          <span>Deterministic example runs for the benchmark view.</span>
        </p>
      )}
      <div className="metrics-strip" aria-label={`${source} metrics`}>
        {metrics.map(({ name, value, unit }) => (
          <dl key={name}>
            <dt>{name}</dt>
            <dd>
              {value} <small>{unit}</small>
            </dd>
          </dl>
        ))}
      </div>
      <div className="telemetry-grid">
        <Trace key={record?.id ?? "session"} samples={samples} label={source} />
        <aside className="side-console telemetry-console" aria-label="Aircraft and selected run">
          <header className="console-header">
            <div>
              <h2>Run summary</h2>
              <span className="console-code">KESTREL XR-07</span>
            </div>
            <div className="console-stamp" aria-hidden="true">
              <Icon name="telemetry" />
            </div>
          </header>
          <div className="console-section run-summary">
            <div className="label-line">
              <span>Status</span>
              <span className="phase-badge" data-phase={record?.outcome ?? flight.phase}>
                {phase}
              </span>
            </div>
            <div className="label-line">
              <span>Score</span>
              <strong>
                {score ?? "—"} {score !== undefined && <small>PTS</small>}
              </strong>
            </div>
            {record && (
              <div className="label-line">
                <span>Run profile</span>
                <span>
                  {record.profile} / {record.paint}
                </span>
              </div>
            )}
          </div>
          <div className="console-section config-list">
            <h3>Current aircraft</h3>
            <dl>
              <div>
                <dt>Finish</dt>
                <dd>
                  <i style={{ background: PAINTS[config.paint].color }} />
                  {config.paint}
                </dd>
              </div>
              <div>
                <dt>Engine</dt>
                <dd>{config.profile}</dd>
              </div>
              <div>
                <dt>Navigation lights</dt>
                <dd>{config.lights ? "On" : "Off"}</dd>
              </div>
            </dl>
          </div>
          <div className="console-action">
            <button type="button" className="secondary-button" onClick={fly}>
              Go to flight range <Icon name="arrow" />
            </button>
          </div>
        </aside>
      </div>

      <section className="archive-shell" aria-label="Mission records">
        <div className="trace-header">
          <div>
            <h2>Mission records</h2>
            <span>{frozen ? "Demonstration archive" : "Local flight archive"}</span>
          </div>
          <div className="segmented trace-tabs" role="group" aria-label="Record view">
            <button type="button" aria-pressed={!showLeaders} onClick={() => setShowLeaders(false)}>
              History
            </button>
            <button type="button" aria-pressed={showLeaders} onClick={() => setShowLeaders(true)}>
              Leaderboard
            </button>
          </div>
        </div>
        {errorRun && (
          <p className="archive-notice" role="alert">
            Mission save failed.{" "}
            <button type="button" onClick={() => retrySave(errorRun)}>
              Retry save
            </button>
          </p>
        )}
        {error && !frozen ? (
          <div className="archive-notice" role="alert">
            Mission storage is unavailable.{" "}
            <button type="button" onClick={() => setAttempt(attempt + 1)}>
              Retry
            </button>
          </div>
        ) : !rows ? (
          <div className="archive-notice" role="status">
            Loading mission records…
          </div>
        ) : rows.length === 0 ? (
          <div className="archive-notice">
            {showLeaders
              ? "Complete all five gates to place on the leaderboard."
              : "No missions recorded. Complete a trial to populate the archive."}
          </div>
        ) : (
          <table className="archive-table">
            <thead>
              <tr>
                <th scope="col">{showLeaders ? "Rank" : "Run"}</th>
                <th scope="col">Result</th>
                <th scope="col">Profile</th>
                <th scope="col">Duration</th>
                <th scope="col">Score</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.id} data-selected={record?.id === row.id || undefined}>
                  <td>
                    <button
                      type="button"
                      aria-pressed={record?.id === row.id}
                      onClick={() => setChosen(row)}
                    >
                      {showLeaders
                        ? String(i + 1).padStart(2, "0")
                        : row.id.slice(0, 8).toUpperCase()}
                    </button>
                  </td>
                  <td>
                    <span className={row.outcome === "success" ? "row-success" : "row-timeout"}>
                      {row.outcome === "success" ? "Complete" : "Timeout"}
                    </span>
                    <small>{date.format(new Date(row.createdAt))}</small>
                  </td>
                  <td>{row.profile}</td>
                  <td>{formatTime(row.durationMs / 1000, 2)}</td>
                  <td>{row.score.toLocaleString("en-US")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
