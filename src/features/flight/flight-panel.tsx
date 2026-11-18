import { useEffect, useRef, type ReactNode } from "react";
import type { SaveState } from "@/components/ui/simulator";
import { Icon } from "@/components/ui/icon";
import type { ResultInput } from "@/features/telemetry/validation";
import { type Control, type FlightEngine, type FlightSnapshot } from "./engine";
import {
  GATES,
  LIMIT,
  PREVIEW,
  scoreRun,
  speedOf,
  type Configuration,
  type Phase,
  type Vec,
} from "./physics";

export const PHASE_LABEL: Record<Phase, string> = {
  ready: "Ready",
  countdown: "Starting",
  active: "In flight",
  paused: "Paused",
  success: "Course complete",
  timeout: "Time expired",
};

export function formatTime(seconds: number, decimals = 1) {
  const whole = Math.floor(Math.max(0, seconds));
  const minutes = String(Math.floor(whole / 60)).padStart(2, "0");
  const remainder = String(whole % 60).padStart(2, "0");
  const factor = 10 ** decimals;
  const fraction = decimals
    ? "." + String(Math.floor(Math.max(0, seconds - whole) * factor + 1e-8)).padStart(decimals, "0")
    : "";
  return minutes + ":" + remainder + fraction;
}

const keys = [
  { control: "forward", label: "Forward", key: "W", icon: "up" },
  { control: "left", label: "Left", key: "A", icon: "left" },
  { control: "back", label: "Back", key: "S", icon: "down" },
  { control: "right", label: "Right", key: "D", icon: "right" },
  { control: "up", label: "Ascend", key: "E", icon: "up" },
  { control: "down", label: "Descend", key: "Q", icon: "down" },
  { control: "boost", label: "Boost", key: "Shift", icon: "boost" },
] as const;

function PilotControls({ engine, enabled }: { engine: FlightEngine; enabled: boolean }) {
  function keyControl(key: string, value: Control, pressed: boolean) {
    engine.setTouch(key, value, pressed);
  }
  return (
    <div className="pilot-controls" role="group" aria-label="Flight controls">
      {keys.map(({ control, label, key, icon }) => (
        <button
          key={control}
          type="button"
          className={`pilot-key key-${control}`}
          aria-label={label}
          aria-keyshortcuts={key}
          disabled={!enabled}
          style={{ touchAction: "none" }}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            keyControl(`touch-${e.pointerId}`, control, true);
          }}
          onLostPointerCapture={(e) => keyControl(`touch-${e.pointerId}`, control, false)}
          onPointerUp={(e) => keyControl(`touch-${e.pointerId}`, control, false)}
          onPointerCancel={(e) => keyControl(`touch-${e.pointerId}`, control, false)}
          onKeyDown={(e) => {
            if (e.key === " " || e.key === "Enter") {
              e.preventDefault();
              keyControl(`focus-${control}-${e.key}`, control, true);
            }
          }}
          onKeyUp={(e) => {
            if (e.key === " " || e.key === "Enter") {
              e.preventDefault();
              keyControl(`focus-${control}-${e.key}`, control, false);
            }
          }}
          onBlur={() => {
            keyControl(`focus-${control}- `, control, false);
            keyControl(`focus-${control}-Enter`, control, false);
          }}
        >
          <Icon name={icon} />
          <kbd>{key}</kbd>
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

function CircuitMap({ position, checkpoints }: { position: Vec; checkpoints: number }) {
  const x = (n: number) => 123 + n * 2.7;
  const y = (n: number) => 14 + (22 - n) * 1.01;
  const points = [[0, 2, 22], ...GATES.map(({ center }) => center)];
  return (
    <svg className="circuit-map" viewBox="0 0 246 113" aria-hidden="true">
      <defs>
        <pattern id="circuit-grid" width="15" height="15" patternUnits="userSpaceOnUse">
          <path d="M0 15V0h15" fill="none" stroke="#263639" strokeWidth=".75" />
        </pattern>
      </defs>
      <rect x="0" width="246" height="113" fill="url(#circuit-grid)" />
      <path
        d={points.map((p, i) => (i ? "L" : "M") + x(p[0]) + " " + y(p[2])).join(" ")}
        fill="none"
        stroke="#557376"
        strokeWidth="1.2"
        strokeDasharray="3 4"
      />
      {GATES.map(({ center }, i) => (
        <g key={i}>
          <circle
            cx={x(center[0])}
            cy={y(center[2])}
            r={i === checkpoints ? "5" : "3.5"}
            fill={i < checkpoints ? "#74c5b5" : "#0e171a"}
            stroke={i === checkpoints ? "#f4a16b" : "#6c9a99"}
          />
          <text
            x={x(center[0]) + 9}
            y={y(center[2]) + 3}
            fill={i === checkpoints ? "#ffb17d" : "#9eb4b5"}
            fontSize="8"
          >
            {i + 1}
          </text>
        </g>
      ))}
      <circle cx={x(position[0])} cy={y(position[2])} r="6.2" fill="#375b5a" opacity=".8" />
      <path
        transform={`translate(${x(position[0])} ${y(position[2])})`}
        d="M0 4-3.5-3 0-1 3.5-3Z"
        fill="#c1fff4"
      />
    </svg>
  );
}

function guidance(position: Vec, index: number) {
  const gate = GATES[index];
  if (!gate) return "Circuit cleared.";
  const x = gate.center[0] - position[0];
  const y = gate.center[1] - position[1];
  const z = gate.center[2] - position[2];
  if (z > 0) return "Return behind the gate and approach it facing downrange.";
  const commands = [];
  if (Math.abs(x) > gate.width * 0.35) commands.push(x > 0 ? "Strafe right" : "Strafe left");
  if (Math.abs(y) > gate.height * 0.29) commands.push(y > 0 ? "Climb" : "Descend");
  if (commands.length === 0) return "Aligned. Fly forward through the lit opening.";
  return commands.join(" · ");
}

export function FlightPanel({
  engine,
  flight,
  config,
  frozen,
  children,
  launch,
  archive,
  saveState,
  retrySave,
}: {
  engine: FlightEngine;
  flight: FlightSnapshot;
  config: Configuration;
  frozen: boolean;
  children: ReactNode;
  launch: () => void;
  archive: () => void;
  saveState: SaveState;
  retrySave: (result: ResultInput) => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const state = frozen ? PREVIEW : flight;
  const { elapsed, checkpoints, collisions, energy } = state;
  const phase = frozen ? "ready" : flight.phase;
  const result = frozen ? null : flight.result;
  const { countdown } = flight;
  const displayed: Phase = frozen ? "active" : phase;
  const speed = speedOf(state);
  const altitude = state.position[1];
  const remaining = Math.max(0, LIMIT - state.elapsed);
  const score = result?.score ?? scoreRun(checkpoints, collisions, elapsed, false);
  const ended = phase === "success" || phase === "timeout";
  const target = GATES[checkpoints]?.center;
  const position = state.position;
  const distance = target ? Math.hypot(...target.map((n, i) => n - position[i])) : 0;
  const savePhase = result && saveState?.id === result.id ? saveState.phase : null;
  function begin() {
    launch();
    viewportRef.current?.focus({ preventScroll: true });
    if (matchMedia("(max-width: 760px)").matches) {
      viewportRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }

  useEffect(() => {
    function press(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || frozen) return;
      const element = event.target instanceof HTMLElement ? event.target : null;
      if (element?.closest("input, textarea, select, [contenteditable=true]")) return;
      if (
        event.code === "Space" &&
        !element?.closest("button, a") &&
        ["active", "paused"].includes(engine.state.phase)
      ) {
        event.preventDefault();
        if (!event.repeat) engine.togglePause();
      } else if (event.code === "KeyR" && engine.state.phase !== "ready") {
        event.preventDefault();
        if (!event.repeat) engine.reset();
      } else if (
        (engine.state.phase === "active" || engine.state.phase === "countdown") &&
        engine.setKey(event.code, true)
      ) {
        event.preventDefault();
      }
    }
    const release = (event: KeyboardEvent) => {
      engine.setKey(event.code, false);
    };
    const blur = () => {
      engine.clearControls();
      if (engine.state.phase === "active") engine.togglePause();
    };
    const hide = () => {
      if (document.hidden) blur();
    };
    window.addEventListener("keydown", press);
    window.addEventListener("keyup", release);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", hide);
    return () => {
      window.removeEventListener("keydown", press);
      window.removeEventListener("keyup", release);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", hide);
      engine.clearControls();
    };
  }, [engine, frozen]);

  return (
    <div className="workspace flight-workspace">
      <section className="viewport-shell" aria-label="Flight viewport">
        <div className="viewport-bar">
          <span className="bar-label">
            <i className="led" /> <span>CHASE FEED</span>
            <span className="feed-index">/ F–05</span>
          </span>
          <span className="phase-badge" data-phase={displayed} data-testid="flight-status">
            {PHASE_LABEL[displayed]}
          </span>
        </div>
        <div
          ref={viewportRef}
          className="stage-window flight-window"
          tabIndex={0}
          aria-label="Flight scene. Use W A S D to steer, Q and E to change height."
          data-position={position.join(",")}
          data-velocity={state.velocity.join(",")}
          data-checkpoints={checkpoints}
        >
          {children}
          <div className="view-matte" aria-hidden="true" />
          <div className="flight-hud">
            <div>
              <span>TIME LEFT</span>
              <strong data-testid="flight-timer">{formatTime(remaining)}</strong>
            </div>
            <div>
              <span>CIRCUIT</span>
              <strong>
                {String(checkpoints).padStart(2, "0")} <small>/ 05</small>
              </strong>
            </div>
            <div>
              <span>SCORE</span>
              <strong>{String(score).padStart(4, "0")}</strong>
            </div>
          </div>
          <div className="flight-readouts">
            <div>
              <small>VELOCITY</small>
              <strong data-testid="flight-speed">
                {speed.toFixed(1)} <small>m/s</small>
              </strong>
            </div>
            <div>
              <small>ALTITUDE</small>
              <strong data-testid="flight-altitude">
                {altitude.toFixed(1)} <small>m</small>
              </strong>
            </div>
            <div>
              <small>ENERGY</small>
              <strong>
                {energy.toFixed(0)}
                <small>%</small>
              </strong>
            </div>
          </div>
          {phase === "countdown" && (
            <div className="flight-overlay" aria-live="polite">
              <span>COURSE STARTS IN</span>
              <strong>{Math.ceil(countdown)}</strong>
            </div>
          )}
          {phase === "paused" && (
            <div className="flight-overlay">
              <span>FLIGHT SUSPENDED</span>
              <strong className="pause-label">Paused</strong>
              <small>Press Space or Resume to continue.</small>
            </div>
          )}
          {ended && (
            <div className="flight-overlay end-overlay">
              <span>
                {checkpoints} OF 5 GATES · {collisions}{" "}
                {collisions === 1 ? "COLLISION" : "COLLISIONS"}
              </span>
              <strong className="pause-label">{PHASE_LABEL[phase]}</strong>
              <small>
                {score} points · {formatTime(elapsed, 2)}
              </small>
            </div>
          )}
        </div>
        <div className="viewport-footer">
          <span>
            <Icon name="flight" /> <kbd>W A S D</kbd> steer <i /> <kbd>Q / E</kbd> altitude <i />{" "}
            <kbd>SHIFT</kbd> boost
          </span>
          <span className="feed-index">
            <kbd>SPACE</kbd> pause <i /> <kbd>R</kbd> reset
          </span>
        </div>
        <PilotControls
          engine={engine}
          enabled={!frozen && (phase === "active" || phase === "countdown")}
        />
      </section>

      <aside className="side-console flight-console" aria-label="Mission controls">
        <header className="console-header">
          <div>
            <h2>Gate trial</h2>
            <span className="console-code">{config.profile} ENGINE PROFILE</span>
          </div>
          <div className="console-stamp" aria-hidden="true">
            <Icon name="crosshair" />
          </div>
        </header>
        <div className="console-section route-section">
          <div className="label-line">
            <span>Course map</span>
            <span>{checkpoints} / 5</span>
          </div>
          <CircuitMap position={position} checkpoints={checkpoints} />
          <ol className="gates" aria-label="Checkpoint progress">
            {GATES.map((_, i) => (
              <li
                key={i}
                data-state={i < checkpoints ? "cleared" : i === checkpoints ? "target" : undefined}
                aria-current={i === checkpoints ? "step" : undefined}
              >
                {i < checkpoints ? <Icon name="check" /> : String(i + 1).padStart(2, "0")}
              </li>
            ))}
          </ol>
        </div>
        <div className="console-section guidance-section">
          <div className="label-line">
            <span>
              {target ? `Gate ${String(checkpoints + 1).padStart(2, "0")}` : "End of course"}
            </span>
            <span>{target ? `${distance.toFixed(1)} m` : "✓"}</span>
          </div>
          <p>{guidance(position, checkpoints)}</p>
          <div className="profile-data">
            <span>
              Collisions <b data-testid="flight-collisions">{collisions}</b>
            </span>
            <span>
              Penalty <b>75 pts / hit</b>
            </span>
          </div>
        </div>
        <div className="console-action flight-actions">
          {(phase === "ready" || ended) && (
            <button type="button" className="primary-button" onClick={begin}>
              {ended ? "Replay trial" : "Start 60s trial"}
              <Icon name={ended ? "reset" : "play"} />
            </button>
          )}
          {(phase === "active" || phase === "paused") && (
            <button type="button" className="primary-button" onClick={() => engine.togglePause()}>
              {phase === "paused" ? "Resume flight" : "Pause flight"}
              <Icon name={phase === "paused" ? "play" : "pause"} />
            </button>
          )}
          {phase === "countdown" && (
            <span className="primary-button pending-start">
              Trial starting…
              <Icon name="clock" />
            </span>
          )}
          {phase !== "ready" && (
            <button type="button" className="secondary-button" onClick={() => engine.reset()}>
              <Icon name="reset" /> Reset flight
            </button>
          )}
          {ended && (
            <button type="button" className="secondary-button" onClick={archive}>
              <Icon name="archive" /> View mission log
            </button>
          )}
          {savePhase === "saving" && (
            <p className="save-message" role="status">
              Saving mission…
            </p>
          )}
          {savePhase === "saved" && (
            <p className="save-message" role="status">
              <Icon name="check" /> Mission saved
            </p>
          )}
          {savePhase === "error" && result && (
            <p className="save-message" role="alert">
              Mission save failed.{" "}
              <button type="button" onClick={() => retrySave(result)}>
                Retry save
              </button>
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
