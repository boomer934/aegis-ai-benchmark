"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { SceneLoader } from "@/components/three/SceneCanvas";
import { PerfPanel } from "@/components/ui/PerfPanel";
import { useRuntime } from "@/components/ui/RuntimeContext";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { modeQuery } from "@/lib/runtime";
import { configStore, useConfig } from "@/stores/configStore";
import { useFlight } from "@/stores/flightStore";
import { getFlightController } from "./controller";
import {
  CenterOverlay,
  ControlsHelp,
  ResultDialog,
  StatusBar,
  TelemetryCluster,
} from "./hud/FlightHud";
import { Minimap } from "./hud/Minimap";
import { TouchControls } from "./hud/TouchControls";
import { useFlightKeyboard } from "./input";
import { useMissionSaver } from "./useMissionSaver";

const FlightCanvas = dynamic(() => import("./FlightCanvas"), {
  ssr: false,
  loading: () => <SceneLoader label="Loading flight arena" />,
});

export function FlightView() {
  const mode = useRuntime();
  const engine = useConfig((s) => s.engine);
  const hydrated = useConfig((s) => s.hydrated);
  const showPerf = useConfig((s) => s.showPerf);
  const status = useFlight((s) => s.status);
  const staged = useFlight((s) => s.staged);
  const controller = useMemo(() => getFlightController(configStore.get().engine), []);
  const coarse = useMediaQuery("(pointer: coarse)");
  const [touchOverride, setTouchOverride] = useState<boolean | null>(null);
  const touch = touchOverride ?? coarse;
  const { retry } = useMissionSaver(true);

  // Apply the hangar's engine selection (only between missions).
  useEffect(() => {
    if (hydrated) {
      controller.syncEngine(engine);
      controller.publish(true);
    }
  }, [controller, engine, hydrated]);

  // Benchmark mode: deterministic staged in-flight state.
  useEffect(() => {
    if (hydrated && mode.benchmark) controller.stageBenchmark();
  }, [controller, hydrated, mode.benchmark]);

  // Leaving the arena or hiding the tab pauses an active mission.
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) controller.autoPause();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      controller.autoPause();
    };
  }, [controller]);

  const handlers = useMemo(
    () => ({
      onPause: () => controller.pause(),
      onReset: () => controller.reset(),
      onStart: () => controller.start(),
      onFlightKey: () => controller.takeControl(),
    }),
    [controller],
  );
  useFlightKeyboard(handlers);

  const active = status === "countdown" || status === "running" || status === "paused";

  return (
    <div className="relative flex flex-1 flex-col">
      <section
        aria-label="Flight arena"
        className="relative min-h-[calc(100dvh-7.5rem)] flex-1 overflow-hidden md:min-h-0"
      >
        <FlightCanvas controller={controller} />

        {/* Top: mission status */}
        <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center px-3">
          <div className="pointer-events-auto max-w-full overflow-x-auto">
            <StatusBar />
          </div>
        </div>

        {/* Left: flight data + controls help */}
        <div className="pointer-events-none absolute left-3 top-24 z-10 flex flex-col gap-3 lg:left-6">
          <TelemetryCluster />
          <div className="pointer-events-auto hidden md:block">
            <ControlsHelp defaultOpen={!mode.benchmark} />
          </div>
        </div>

        {/* Right: tactical map */}
        <div className="pointer-events-none absolute right-3 top-24 z-10 hidden h-[300px] w-[150px] md:block lg:right-6">
          <div className="panel h-full p-2">
            <div className="label mb-1 !text-[9px]">Course map</div>
            <div className="h-[calc(100%-18px)]">
              <Minimap />
            </div>
          </div>
        </div>

        <CenterOverlay />

        {/* Bottom: mission actions */}
        <div
          className={`absolute inset-x-0 z-20 flex justify-center gap-2 px-3 ${touch ? "bottom-40" : "bottom-6"}`}
        >
          {staged ? (
            <div className="panel px-4 py-2 text-[12px] text-steel-300" data-testid="staged-hint">
              Benchmark staged flight · press any flight key or{" "}
              <span className="text-ion-300">Start</span> to take control
            </div>
          ) : null}
          {!active && status !== "success" && status !== "failed" && (
            <button
              type="button"
              onClick={() => controller.start()}
              className="bg-ion-400 px-6 py-3 font-[family-name:var(--font-display)] text-[13px] font-semibold uppercase tracking-[0.22em] text-void shadow-[0_0_30px_-6px_rgba(79,227,251,0.9)]"
              data-testid="start-mission"
            >
              Start mission <span className="font-mono text-[10px] opacity-70">(Enter)</span>
            </button>
          )}
          {active && (
            <>
              <button
                type="button"
                onClick={() => controller.pause()}
                aria-pressed={status === "paused"}
                className="seg-btn panel-flat border border-amber-500/50 px-4 py-2.5 text-[12px] text-amber-400"
                data-testid="pause-button"
              >
                {status === "paused" ? "Resume" : "Pause"}{" "}
                <span className="font-mono text-[10px] opacity-70">(Space)</span>
              </button>
              <button
                type="button"
                onClick={() => controller.reset()}
                className="seg-btn panel-flat border border-graphite-600 px-4 py-2.5 text-[12px] text-steel-200"
                data-testid="reset-button"
              >
                Reset <span className="font-mono text-[10px] opacity-70">(R)</span>
              </button>
            </>
          )}
        </div>

        {touch && <TouchControls onInput={() => controller.takeControl()} />}
        <button
          type="button"
          onClick={() => setTouchOverride(!touch)}
          aria-pressed={touch}
          className="seg-btn panel-flat absolute bottom-6 right-3 z-20 hidden border border-graphite-600 px-2.5 py-1.5 text-[10px] text-steel-300 md:block lg:right-6"
          data-testid="touch-toggle"
        >
          Touch controls
        </button>

        <ResultDialog
          onReplay={() => controller.reset()}
          onRetrySave={retry}
          controlHref={`/control${modeQuery(mode)}`}
        />
        {showPerf && !mode.benchmark && <PerfPanel />}
      </section>
    </div>
  );
}
