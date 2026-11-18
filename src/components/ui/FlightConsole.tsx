import { GATES, score } from "@/features/flight/simulation";
import { useFacility, usePhase, type Facility } from "@/stores/facility";
import { Icon } from "./Marks";
const MOVES = [
  ["A", "KeyA", "Left"],
  ["W", "KeyW", "Forward"],
  ["S", "KeyS", "Back"],
  ["D", "KeyD", "Right"],
  ["Q", "KeyQ", "Descend"],
  ["E", "KeyE", "Ascend"],
  ["Shift", "Shift", "Boost"],
];
export function FlightHud({ s }: { s: Facility }) {
  useFacility(s);
  const f = s.sim.state;
  const running = f.phase === "running";
  return (
    <>
      <div className="feed">
        <i />
        Range feed
      </div>
      <div className="feed-address">CAM / CHASE</div>
      <div className="flight-hud" data-position={JSON.stringify(f.position)}>
        <div>
          <span className="label">Time left</span>
          <b>
            {Math.ceil(60 - f.elapsed)
              .toString()
              .padStart(2, "0")}
            <small> s</small>
          </b>
        </div>
        <div>
          <span className="label">Altitude</span>
          <b data-testid="altitude">
            {f.position.y.toFixed(1)}
            <small> m</small>
          </b>
        </div>
        <div>
          <span className="label">Velocity</span>
          <b data-testid="velocity">
            {Math.hypot(f.velocity.x, f.velocity.y, f.velocity.z).toFixed(1)}
            <small> m/s</small>
          </b>
        </div>
      </div>
      {f.phase === "countdown" && (
        <div className="flight-message countdown">{Math.max(1, Math.ceil(f.countdown))}</div>
      )}
      {f.phase === "paused" && <div className="flight-message">Flight paused</div>}
      {running && (
        <div className="reticle" aria-hidden="true">
          +
        </div>
      )}
    </>
  );
}
export function FlightConsole({ s }: { s: Facility }) {
  useFacility(s);
  const f = s.sim.state,
    ended = f.phase === "timeout" || f.phase === "success";
  return (
    <aside className="panel flight-console">
      <div className="panel-heading">
        <Icon name="flag" />
        <h2>Mission brief</h2>
      </div>
      <div className="mission-title">
        <span className="label">Range 02</span>
        <h3>Gate circuit</h3>
        <p>Fly through five gates in order within 60 seconds. Each collision costs 150 points.</p>
      </div>
      <div className="mission-readout">
        <span>Status</span>
        <b data-testid="phase">{f.phase}</b>
        <span>Engine</span>
        <b>{s.sortie?.profile ?? s.settings.profile}</b>
        <span>Checkpoints</span>
        <b>{f.gates} / 5</b>
        <span>Collisions</span>
        <b>{f.collisions}</b>
        <span>Score</span>
        <b>{score(f.gates, f.collisions, Math.round(f.elapsed * 1000))}</b>
      </div>
      <div className="gate-scale" aria-label="Checkpoint sequence">
        {GATES.map((_, i) => (
          <span key={i} data-state={i < f.gates ? "done" : i === f.gates ? "next" : ""}>
            {i < f.gates ? <Icon name="check" size={13} /> : String(i + 1).padStart(2, "0")}
          </span>
        ))}
      </div>
      {ended && (
        <div role="status" className="flight-result">
          <b>{f.phase === "success" ? "Circuit complete" : "Time expired"}</b> ·{" "}
          {f.elapsed.toFixed(2)} s<br />
          {s.saveStatus === "error" ? (
            <button onClick={() => void s.save()}>Archive unavailable · Retry save</button>
          ) : s.saveStatus === "saved" ? (
            "Mission archived"
          ) : (
            "Saving mission…"
          )}
        </div>
      )}
      <div className="action-dock">
        <button
          className="primary"
          disabled={f.phase === "countdown"}
          onClick={() =>
            f.phase === "paused" || f.phase === "running" ? s.togglePause() : s.start()
          }
        >
          <Icon name={f.phase === "running" ? "pause" : "play"} />
          {f.phase === "running"
            ? "Pause flight"
            : f.phase === "paused"
              ? "Resume flight"
              : ended
                ? "Fly again"
                : f.phase === "countdown"
                  ? "Launching…"
                  : "Start challenge"}
        </button>
        <button className="reset" onClick={() => s.reset()}>
          <Icon name="rotate" size={14} />
          Reset flight
        </button>
      </div>
    </aside>
  );
}
export function FlightKeys({ s }: { s: Facility }) {
  const phase = usePhase(s);
  return (
    <section className="pilot-input">
      <div>
        <strong>Pilot controls</strong>
        <span>Hold a key or press a control</span>
      </div>
      <div className="key-group">
        {MOVES.map(([title, code, label]) => (
          <button
            key={code}
            aria-label={label}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              s.keys.add(code);
            }}
            onPointerUp={() => s.keys.delete(code)}
            onLostPointerCapture={() => s.keys.delete(code)}
            onPointerCancel={() => s.keys.delete(code)}
            onKeyDown={(e) => {
              if (["Enter", " "].includes(e.key)) {
                e.preventDefault();
                s.keys.add(code);
              }
            }}
            onKeyUp={() => s.keys.delete(code)}
            onBlur={() => s.keys.delete(code)}
          >
            <kbd>{title}</kbd>
            {label}
          </button>
        ))}
      </div>
      <small>Space · Pause &nbsp; R · Reset</small>
      <div className="touch-actions">
        <button
          onClick={() => (phase === "running" || phase === "paused" ? s.togglePause() : s.start())}
          disabled={phase === "countdown"}
        >
          {phase === "running"
            ? "Pause"
            : phase === "paused"
              ? "Resume"
              : phase === "countdown"
                ? "Launching…"
                : "Start challenge"}
        </button>
        <button onClick={() => s.reset()}>Reset</button>
      </div>
    </section>
  );
}
