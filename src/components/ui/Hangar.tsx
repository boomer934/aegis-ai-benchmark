import { AirframePlan, Icon } from "./Marks";
import { PAINTS, PROFILES, type Paint, type Profile } from "@/features/flight/simulation";
import { useFacility, type Facility, type Camera } from "@/stores/facility";
export function Config({ s, launch }: { s: Facility; launch: () => void }) {
  useFacility(s);
  const cfg = s.settings;
  return (
    <aside className="panel config">
      <div className="panel-heading">
        <Icon name="sliders" />
        <h2>Configuration</h2>
      </div>
      <div className="airframe-id">
        <div>
          <span className="label">Airframe</span>
          <strong>AX–04</strong>
          <small>Research quadcopter</small>
        </div>
        <AirframePlan />
      </div>
      <fieldset>
        <legend>Exterior finish</legend>
        <div className="paint-options">
          {(Object.keys(PAINTS) as Paint[]).map((p) => (
            <button
              key={p}
              className="paint-choice"
              aria-pressed={cfg.paint === p}
              onClick={() => s.configure({ paint: p })}
            >
              <span className="swatch" style={{ backgroundColor: PAINTS[p] }}>
                {p === cfg.paint && <Icon name="check" size={15} />}
              </span>
              {p}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="engine-field">
        <legend>Engine profile</legend>
        <div className="segments">
          {(Object.keys(PROFILES) as Profile[]).map((p) => (
            <button
              key={p}
              aria-pressed={cfg.profile === p}
              onClick={() => s.configure({ profile: p })}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="profile-note">
          <span className="tiny-bars">
            {[0, 1, 2].map((i) => (
              <i key={i} className={i <= Object.keys(PROFILES).indexOf(cfg.profile) ? "lit" : ""} />
            ))}
          </span>
          {
            { ECO: "Endurance tuning", SPORT: "Balanced response", RACE: "Maximum thrust" }[
              cfg.profile
            ]
          }
        </div>
      </fieldset>
      <div className="light-row">
        <span>
          <Icon name="bulb" />
          Navigation lights
        </span>
        <button
          role="switch"
          aria-label="Navigation lights"
          aria-checked={cfg.lights}
          onClick={() => s.configure({ lights: !cfg.lights })}
          className="switch"
        >
          <i />
        </button>
      </div>
      <div className="action-dock">
        <button className="primary" onClick={launch}>
          <Icon name="flight" />
          Enter flight arena
          <Icon name="arrow" />
        </button>
      </div>
    </aside>
  );
}
export function HangarHud() {
  return (
    <>
      <div className="feed">
        <i />
        Hangar feed
      </div>
      <div className="feed-address">CAM / H–04</div>
      <div className="vehicle-tag">
        <span className="unit-rule" />{" "}
        <div>
          <span className="label">AX–04 / Research quadcopter</span>
          <h2>Kestrel X4</h2>
        </div>
      </div>
      <div className="axis" aria-hidden="true">
        <svg width="46" height="40" viewBox="0 0 46 40">
          <g fill="none" strokeWidth="1.25">
            <path stroke="#70cbd0" d="M21 25V5" />
            <path stroke="#d99064" d="m21 25 19 6" />
            <path stroke="#b1c5c8" d="m21 25-16 7" />
          </g>
          <circle cx="21" cy="25" r="2" fill="#c9d1d2" />
        </svg>
      </div>
    </>
  );
}
export function CameraBar({ s }: { s: Facility }) {
  useFacility(s);
  return (
    <div className="camera-bar">
      <Icon name="camera" />
      <span className="label">Camera</span>
      <div className="cam-opts">
        {(["hero", "side", "top"] as Camera[]).map((p) => (
          <button
            key={p}
            aria-pressed={s.settings.camera === p}
            onClick={() => s.configure({ camera: p, inspect: false })}
          >
            {p[0].toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>
      <div className="zoom-buttons">
        <button aria-label="Zoom out" title="Zoom out" onClick={() => s.zoom(1.15)}>
          −
        </button>
        <button aria-label="Zoom in" title="Zoom in" onClick={() => s.zoom(1 / 1.15)}>
          +
        </button>
      </div>
      <button
        className="inspect"
        aria-pressed={s.settings.inspect}
        onClick={() => s.configure({ inspect: !s.settings.inspect })}
      >
        <Icon name="rotate" />
        {s.settings.inspect ? "Stop inspection" : "Inspect"}
      </button>
    </div>
  );
}
export function Specs({ s }: { s: Facility }) {
  useFacility(s);
  const cfg = PROFILES[s.settings.profile];
  return (
    <section className="specstrip" aria-label="Airframe specifications">
      <div className="spec-heading">
        <Icon name="chip" size={24} />
        <div>
          <span className="label">Airframe data</span>
          <strong>Specifications</strong>
        </div>
      </div>
      {[
        ["Rotor layout", "Quad / 4"],
        ["Speed limit", cfg.speed + " m/s"],
        ["Boost limit", cfg.speed * 1.5 + " m/s"],
        ["Acceleration", cfg.acceleration + " m/s²"],
      ].map(([k, v]) => (
        <div className="spec" key={k}>
          <span className="label">{k}</span>
          <strong>{v}</strong>
        </div>
      ))}
    </section>
  );
}
