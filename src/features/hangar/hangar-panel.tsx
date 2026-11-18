import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import {
  PAINTS,
  PROFILES,
  type Configuration,
  type Paint,
  type Profile,
} from "@/features/flight/physics";
import type { HangarCamera } from "./hangar-scene";

const cameras: HangarCamera[] = ["Hero", "Side", "Top"];
const paints = Object.keys(PAINTS) as Paint[];
const profiles = Object.keys(PROFILES) as Profile[];

export function HangarPanel({
  config,
  inspection,
  reduced,
  camera,
  children,
  setConfig,
  chooseCamera,
  toggleInspection,
  launch,
}: {
  config: Configuration;
  inspection: boolean;
  reduced: boolean;
  camera: HangarCamera;
  children: ReactNode;
  setConfig: (next: Configuration) => void;
  chooseCamera: (next: HangarCamera) => void;
  toggleInspection: () => void;
  launch: () => void;
}) {
  return (
    <div className="workspace">
      <section className="viewport-shell" aria-label="Hangar viewport">
        <div className="viewport-bar">
          <span className="bar-label">
            <i className="led" /> <span>OPTICAL FEED</span>
            <span className="feed-index">/ 07</span>
          </span>
          <div className="segmented camera-tabs" role="group" aria-label="Camera angle">
            {cameras.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={camera === item}
                onClick={() => chooseCamera(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <div className="stage-window hangar-window">
          {children}
          <div className="view-matte" aria-hidden="true" />
          <div className="view-livery">
            <strong>
              KESTREL<span> XR-07</span>
            </strong>
          </div>
          <div className="view-corner corner-a" aria-hidden="true" />
          <div className="view-corner corner-b" aria-hidden="true" />
          <div className="view-corner corner-c" aria-hidden="true" />
          <div className="view-corner corner-d" aria-hidden="true" />
          <div className="floor-indicator" aria-hidden="true">
            <span /> <span /> <span />
          </div>
        </div>
        <div className="viewport-footer">
          <span>
            <Icon name="orbit" /> Drag to orbit <i /> Scroll or pinch to zoom
          </span>
          <span className="feed-index">{inspection ? "INSPECTION ACTIVE" : "MANUAL VIEW"}</span>
        </div>
      </section>

      <aside className="side-console" aria-label="Aircraft configuration">
        <header className="console-header">
          <div>
            <h2>Aircraft setup</h2>
            <span className="console-code">XR-07 / QUADCOPTER</span>
          </div>
          <div className="console-stamp" aria-hidden="true">
            <Icon name="crosshair" />
          </div>
        </header>

        <fieldset className="console-section">
          <legend>Airframe finish</legend>
          <div className="paint-options">
            {paints.map((paint) => (
              <button
                className="paint-choice"
                type="button"
                key={paint}
                aria-pressed={config.paint === paint}
                onClick={() => setConfig({ ...config, paint })}
              >
                <span className={`swatch swatch-${paint.toLowerCase()}`}>
                  {config.paint === paint && <Icon name="check" />}
                </span>
                <span>{paint}</span>
              </button>
            ))}
          </div>
          <p className="finish-note" data-testid="paint-description">
            {PAINTS[config.paint].description}
          </p>
        </fieldset>

        <fieldset className="console-section">
          <legend>Engine profile</legend>
          <div className="segmented engine-tabs">
            {profiles.map((profile) => (
              <button
                type="button"
                key={profile}
                aria-pressed={config.profile === profile}
                onClick={() => setConfig({ ...config, profile })}
              >
                {profile}
              </button>
            ))}
          </div>
          <div className="profile-data">
            <span>
              Speed limit <b>{PROFILES[config.profile].speed} m/s</b>
            </span>
            <span>
              Acceleration <b>{PROFILES[config.profile].acceleration} m/s²</b>
            </span>
            <span>
              Base energy draw <b>{PROFILES[config.profile].draw.toFixed(2)}% / s</b>
            </span>
          </div>
        </fieldset>

        <div className="console-section console-switches">
          <button
            type="button"
            role="switch"
            aria-checked={config.lights}
            onClick={() => setConfig({ ...config, lights: !config.lights })}
          >
            <Icon name="light" />
            <span>Navigation lights</span>
            <i className="toggle" />
          </button>
          <button
            type="button"
            role="switch"
            aria-checked={inspection}
            disabled={reduced}
            onClick={toggleInspection}
            title={reduced ? "Disabled by your reduced-motion preference" : undefined}
          >
            <Icon name="orbit" />
            <span>Inspection orbit</span>
            <i className="toggle" />
          </button>
        </div>

        <div className="console-action">
          <button className="primary-button" type="button" onClick={launch}>
            <span>Enter flight range</span>
            <Icon name="arrow" />
          </button>
        </div>
      </aside>
    </div>
  );
}
