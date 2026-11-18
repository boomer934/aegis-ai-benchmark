"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { FlightEngine } from "@/features/flight/engine";
import { DEFAULT_CONFIG, PREVIEW, type Configuration } from "@/features/flight/physics";
import { HangarPanel } from "@/features/hangar/hangar-panel";
import { FlightPanel } from "@/features/flight/flight-panel";
import { MissionControl } from "@/features/telemetry/mission-control";
import type { ResultInput } from "@/features/telemetry/validation";
import type { HangarCamera } from "@/features/hangar/hangar-scene";
import type { Quality } from "@/components/three/stage";
import { AegisMark, Icon } from "./icon";

const loader = () => <div className="stage-loading">INITIALIZING 3D VIEWPORT</div>;
const HangarScene = dynamic(() => import("@/features/hangar/hangar-scene"), {
  ssr: false,
  loading: loader,
});
const FlightScene = dynamic(() => import("@/features/flight/flight-scene"), {
  ssr: false,
  loading: loader,
});

export type Module = "hangar" | "flight" | "telemetry";
export type Options = {
  module: Module;
  camera: HangarCamera;
  benchmark: boolean;
  perf: boolean;
  seed: number;
};
export type SaveState = { id: string; phase: "saving" | "saved" | "error" } | null;

const tabs = [
  { key: "hangar", name: "Hangar" },
  { key: "flight", name: "Flight" },
  { key: "telemetry", name: "Mission Control" },
] as const;
const descriptions = {
  hangar: {
    title: "Engineering Hangar",
    intro: "Inspect and configure the Kestrel XR-07 test airframe.",
    zone: "INDOOR TEST BAY",
  },
  flight: {
    title: "Flight Range",
    intro: "Fly five gates in sequence before the 60-second clock expires.",
    zone: "FLIGHT TEST SECTOR",
  },
  telemetry: {
    title: "Mission Control",
    intro: "Review the flight trace, recorded missions and best runs.",
    zone: "FLIGHT DATA SYSTEM",
  },
};

const motionQuery = "(prefers-reduced-motion: reduce)";
function subscribeMotion(notify: () => void) {
  const query = matchMedia(motionQuery);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
}
const useReducedMotion = () =>
  useSyncExternalStore(
    subscribeMotion,
    () => matchMedia(motionQuery).matches,
    () => false,
  );

function moduleFromURL(): Module {
  const scene = new URLSearchParams(location.search).get("scene");
  return scene === "flight" || scene === "telemetry" ? scene : "hangar";
}

export function Simulator({ initial }: { initial: Options }) {
  const [active, setActive] = useState(initial.module);
  const [frozen, setFrozen] = useState(initial.benchmark);
  const [config, setConfig] = useState<Configuration>(DEFAULT_CONFIG);
  const [quality, setQuality] = useState<Quality>("HIGH");
  const [inspection, setInspection] = useState(false);
  const [angle, setAngle] = useState({ camera: initial.camera, revision: 0 });
  const [saveState, setSaveState] = useState<SaveState>(null);
  const reduced = useReducedMotion();

  const save = useCallback(async (result: ResultInput) => {
    setSaveState({ id: result.id, phase: "saving" });
    try {
      const response = await fetch("/api/missions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error("Mission storage rejected the run");
      setSaveState((current) =>
        current?.id === result.id ? { id: result.id, phase: "saved" } : current,
      );
    } catch {
      setSaveState((current) =>
        current?.id === result.id ? { id: result.id, phase: "error" } : current,
      );
    }
  }, []);
  const [engine] = useState(
    () =>
      new FlightEngine((result) => {
        void save(result);
      }),
  );
  const flight = useSyncExternalStore(
    engine.subscribe,
    engine.getSnapshot,
    engine.getServerSnapshot,
  );

  const changeModule = useCallback(
    (next: Module) => {
      if (engine.state.phase === "active" && next !== "flight") engine.togglePause();
      engine.clearControls();
      setActive(next);
    },
    [engine],
  );
  useEffect(() => {
    const onPop = () => {
      changeModule(moduleFromURL());
      const params = new URLSearchParams(location.search);
      setFrozen(params.get("benchmark") === "1");
      setAngle((previous) => ({
        camera: params.get("camera") === "top" ? "Top" : "Hero",
        revision: previous.revision + 1,
      }));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [changeModule]);

  function go(next: Module) {
    if (next === active && !frozen) return;
    const url = new URL(location.href);
    url.searchParams.delete("benchmark");
    url.searchParams.delete("camera");
    if (next === "hangar") url.searchParams.delete("scene");
    else url.searchParams.set("scene", next);
    history.pushState(null, "", url);
    setFrozen(false);
    changeModule(next);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function exitBenchmark() {
    if (!frozen) return;
    const url = new URL(location.href);
    url.searchParams.delete("benchmark");
    history.replaceState(null, "", url);
    setFrozen(false);
  }

  const graphics = initial.perf || frozen ? "HIGH" : quality;
  const info = descriptions[active];
  const viewConfig = frozen ? DEFAULT_CONFIG : config;
  const view = {
    config: viewConfig,
    quality: graphics,
    performance: initial.perf,
    frozen,
    seed: initial.seed,
    reduced,
  };
  // A run keeps its launch configuration even if the user visits the hangar while paused.
  const locked =
    flight.phase === "countdown" || flight.phase === "active" || flight.phase === "paused";
  const flightConfig = frozen ? DEFAULT_CONFIG : (engine.getConfiguration() ?? config);

  return (
    <div className="facility">
      <header className="topbar">
        <button
          type="button"
          className="brand"
          aria-label="AEGIS Hangar"
          onClick={() => go("hangar")}
        >
          <AegisMark />
          <span>
            <b>AEGIS</b>
            <small>DRONE TEST FACILITY</small>
          </span>
        </button>
        <nav aria-label="Facility modules">
          {tabs.map(({ key, name }) => (
            <button
              type="button"
              key={key}
              onClick={() => go(key)}
              aria-current={active === key ? "page" : undefined}
              className="nav-tab"
            >
              <Icon name={key} />
              <span>{name}</span>
            </button>
          ))}
        </nav>
        <div className="top-tools">
          <span className="local-signal">
            <i className="led" /> LOCAL FACILITY
          </span>
          <label className="quality-select">
            <Icon name="quality" />
            <select
              aria-label="Graphics quality"
              disabled={initial.perf || frozen}
              value={graphics}
              onChange={(e) => setQuality(e.target.value as Quality)}
            >
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
            </select>
          </label>
        </div>
      </header>

      <main className="facility-main" id="main" tabIndex={-1}>
        <header className="page-heading">
          <div>
            <h1>{info.title}</h1>
            <p>{info.intro}</p>
          </div>
          <div className="zone">
            <Icon name={active === "hangar" ? "crosshair" : active} />
            <span>
              {info.zone}
              <b>
                {active === "hangar"
                  ? "BAY / A–07"
                  : active === "flight"
                    ? "COURSE / F–05"
                    : "RECORDER / MC–01"}
              </b>
            </span>
          </div>
        </header>
        {active === "hangar" && (
          <HangarPanel
            config={viewConfig}
            inspection={!frozen && inspection && !reduced}
            reduced={reduced}
            camera={angle.camera}
            launch={() => go("flight")}
            setConfig={(next) => {
              exitBenchmark();
              setConfig(next);
            }}
            chooseCamera={(camera) => {
              exitBenchmark();
              setAngle({ camera, revision: angle.revision + 1 });
            }}
            toggleInspection={() => {
              exitBenchmark();
              setInspection(!inspection);
            }}
          >
            <HangarScene
              {...view}
              camera={angle.camera}
              cameraRevision={angle.revision}
              inspection={inspection}
            />
          </HangarPanel>
        )}
        {active === "flight" && (
          <FlightPanel
            engine={engine}
            flight={flight}
            config={frozen || locked ? flightConfig : config}
            frozen={frozen}
            launch={() => {
              exitBenchmark();
              engine.start(config);
            }}
            archive={() => go("telemetry")}
            saveState={saveState}
            retrySave={save}
          >
            <FlightScene
              {...view}
              config={flightConfig}
              engine={engine}
              checkpoints={frozen ? PREVIEW.checkpoints : flight.checkpoints}
            />
          </FlightPanel>
        )}
        {active === "telemetry" && (
          <MissionControl
            key={frozen ? "demo" : "live"}
            config={viewConfig}
            flight={flight}
            frozen={frozen}
            saveState={saveState}
            retrySave={save}
            fly={() => go("flight")}
          />
        )}
        <footer className="facility-footer">
          <span>
            <i className="led" /> AEGIS FLIGHT SYSTEMS
          </span>
          <span>
            KESTREL XR-07 <i /> TEST FACILITY
          </span>
        </footer>
      </main>
    </div>
  );
}
