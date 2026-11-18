"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect } from "react";
import { SceneLoader } from "@/components/three/SceneCanvas";
import { SectionTitle, Segmented, StatBar, Toggle } from "@/components/ui/controls";
import { PerfPanel } from "@/components/ui/PerfPanel";
import { useRuntime } from "@/components/ui/RuntimeContext";
import { PAINT_IDS, PAINTS, type PaintId } from "@/domain/config";
import { modeQuery, parseHangarCamera, type HangarCamera } from "@/lib/runtime";
import { ENGINE_IDS, ENGINE_PROFILES, type EngineId } from "@/sim/profiles";
import { configStore, useConfig } from "@/stores/configStore";
import { INSPECTION_STEPS, requestPreset, setInspection, useHangar } from "./hangarStore";

const HangarCanvas = dynamic(() => import("./HangarCanvas"), {
  ssr: false,
  loading: () => <SceneLoader label="Loading hangar" />,
});

const MAX = { speed: ENGINE_PROFILES.RACE.maxSpeed, accel: ENGINE_PROFILES.RACE.accel, drain: ENGINE_PROFILES.RACE.throttleDrain };

function PaintSwatches() {
  const paint = useConfig((s) => s.paint);
  return (
    <div role="radiogroup" aria-label="Paint configuration" className="grid grid-cols-3 gap-2" data-testid="paint-selector">
      {PAINT_IDS.map((id: PaintId) => {
        const p = PAINTS[id];
        const active = paint === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            data-value={id}
            onClick={() => configStore.set({ paint: id })}
            className={`group flex flex-col items-start gap-2 border p-2 text-left transition-colors ${
              active ? "border-ion-400 bg-ion-400/10" : "border-graphite-600 bg-graphite-900/60 hover:border-ion-500/60"
            }`}
          >
            <span className="relative block h-7 w-full overflow-hidden" aria-hidden="true">
              <span className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${p.hull} 0 58%, ${p.frame} 58% 100%)` }} />
              <span className="absolute bottom-1 left-1 right-1 h-[3px]" style={{ background: p.accent, boxShadow: `0 0 8px ${p.accent}` }} />
            </span>
            <span className="font-[family-name:var(--font-display)] text-[11px] uppercase leading-tight tracking-[0.12em] text-steel-100">
              {p.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function EngineSection() {
  const engine = useConfig((s) => s.engine);
  const p = ENGINE_PROFILES[engine];
  return (
    <div className="grid gap-3">
      <Segmented<EngineId>
        label="Engine profile"
        testId="engine-selector"
        value={engine}
        onChange={(v) => configStore.set({ engine: v })}
        options={ENGINE_IDS.map((id) => ({ value: id, label: id, hint: ENGINE_PROFILES[id].tagline }))}
      />
      <div className="grid gap-1.5" data-testid="engine-stats">
        <StatBar label="Top speed" value={p.maxSpeed / MAX.speed} display={`${p.maxSpeed} m/s`} />
        <StatBar label="Thrust" value={p.accel / MAX.accel} display={`${p.accel} m/s²`} />
        <StatBar label="Boost" value={(p.boostMultiplier - 1) / 0.5} display={`×${p.boostMultiplier}`} />
        <StatBar label="Power draw" value={p.throttleDrain / MAX.drain} display={`${p.throttleDrain}%/s`} tone="amber" />
      </div>
      <p className="text-[11px] leading-relaxed text-steel-400">
        <span className="text-steel-200">{p.tagline}.</span> These values drive the flight model directly: acceleration, drag,
        speed caps and energy drain.
      </p>
    </div>
  );
}

function InspectionChecklist() {
  const inspecting = useHangar((s) => s.inspecting);
  const progress = useHangar((s) => s.progress);
  if (!inspecting) return null;
  return (
    <div className="panel pointer-events-auto w-[280px] p-4" data-testid="inspection-panel" aria-live="polite">
      <div className="flex items-center justify-between">
        <span className="label !text-ion-300">Inspection sequence</span>
        <span className="readout text-sm text-steel-100">{Math.round(progress * 100)}%</span>
      </div>
      <div className="mt-2 h-1 bg-graphite-700">
        <div className="h-full bg-ion-400 transition-[width]" style={{ width: `${progress * 100}%` }} />
      </div>
      <ul className="mt-3 grid gap-1.5">
        {INSPECTION_STEPS.map((s) => {
          const done = progress >= s.at;
          return (
            <li key={s.system} className="grid grid-cols-[14px_1fr] gap-2 text-[11px]">
              <span aria-hidden="true" className={`mt-1 h-2 w-2 ${done ? "bg-signal-green shadow-[0_0_6px_#3df2a5]" : "border border-graphite-600"}`} />
              <span>
                <span className={`block uppercase tracking-[0.12em] ${done ? "text-steel-100" : "text-steel-400"}`}>{s.system}</span>
                {done && <span className="block text-steel-400">{s.detail}</span>}
              </span>
              <span className="sr-only">{done ? "passed" : "pending"}</span>
            </li>
          );
        })}
      </ul>
      {progress >= 1 && <div className="label mt-3 !text-signal-green">All systems nominal — cleared for flight</div>}
    </div>
  );
}

export function HangarView() {
  const mode = useRuntime();
  const preset = useHangar((s) => s.preset);
  const inspecting = useHangar((s) => s.inspecting);
  const lights = useConfig((s) => s.lights);
  const paint = useConfig((s) => s.paint);
  const showPerf = useConfig((s) => s.showPerf);

  useEffect(() => {
    if (mode.camera) requestPreset(parseHangarCamera(mode.camera));
    else if (mode.benchmark) requestPreset("hero");
  }, [mode.camera, mode.benchmark]);

  useEffect(() => () => setInspection(false), []);

  return (
    <div className="relative flex flex-1 flex-col lg:block">
      <section aria-label="Hangar 3D view" className="relative h-[54dvh] min-h-[320px] shrink-0 overflow-hidden lg:absolute lg:inset-0 lg:h-auto">
        <HangarCanvas />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_0%_0%,rgba(5,7,10,0.85)_0%,rgba(5,7,10,0.35)_32%,transparent_55%)]"
        />
        {/* Title block */}
        <div className="pointer-events-none absolute left-4 top-4 md:left-8 md:top-7">
          <div className="label !text-amber-500">Test article · Unit 07</div>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-light uppercase tracking-[0.14em] text-steel-100 md:text-5xl">
            AX-7 <span className="font-semibold">Kestrel</span>
          </h1>
          <div className="mt-3 hidden gap-6 md:flex">
            {[
              ["Span", "1.45 m"],
              ["Mass", "2.4 kg"],
              ["Rotors", "4 × 9.2 in"],
              ["Livery", PAINTS[paint].name],
            ].map(([k, v]) => (
              <div key={k}>
                <div className="label !text-[9px]">{k}</div>
                <div className="readout text-sm text-steel-200">{v}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="pointer-events-none absolute left-4 top-40 hidden lg:block xl:left-8">
          <InspectionChecklist />
        </div>
        <div className="pointer-events-none absolute bottom-3 left-4 flex items-center gap-3 md:bottom-6 md:left-8">
          <span className="label !text-[9px] text-steel-400">Drag to orbit · Scroll or pinch to zoom</span>
        </div>
        {showPerf && !mode.benchmark && <PerfPanel />}
      </section>

      <aside
        aria-label="Drone configuration"
        className="panel relative z-10 m-3 flex flex-col gap-5 p-4 lg:absolute lg:bottom-6 lg:right-6 lg:top-6 lg:m-0 lg:w-[360px] lg:overflow-y-auto lg:p-5"
      >
        <div>
          <SectionTitle index="A">Camera</SectionTitle>
          <Segmented<HangarCamera>
            label="Camera preset"
            testId="camera-selector"
            value={preset}
            onChange={requestPreset}
            options={[
              { value: "hero", label: "Hero" },
              { value: "side", label: "Side" },
              { value: "top", label: "Top" },
            ]}
          />
        </div>
        <div className="hairline" />
        <div>
          <SectionTitle index="B">Livery</SectionTitle>
          <PaintSwatches />
        </div>
        <div className="hairline" />
        <div>
          <SectionTitle index="C">Engine profile</SectionTitle>
          <EngineSection />
        </div>
        <div className="hairline" />
        <div className="grid gap-2">
          <SectionTitle index="D">Systems</SectionTitle>
          <Toggle
            label="Drone lighting"
            description="Nav lights, strobes and ion trim"
            checked={lights}
            onChange={(v) => configStore.set({ lights: v })}
            testId="lights-toggle"
          />
          <button
            type="button"
            aria-pressed={inspecting}
            onClick={() => setInspection(!inspecting)}
            data-testid="inspection-toggle"
            className={`seg-btn flex items-center justify-between border px-3 py-2.5 text-[12px] ${
              inspecting ? "" : "border-amber-500/60 text-amber-400 hover:bg-amber-500/10"
            }`}
          >
            <span>{inspecting ? "Stop inspection" : "Start inspection"}</span>
            <span aria-hidden="true" className="font-mono text-[10px]">{inspecting ? "■" : "▶"}</span>
          </button>
          <div className="lg:hidden">
            <InspectionChecklist />
          </div>
        </div>
        <Link
          href={`/flight${modeQuery(mode)}`}
          className="group mt-auto flex items-center justify-between bg-ion-400 px-4 py-3 font-[family-name:var(--font-display)] text-[13px] font-semibold uppercase tracking-[0.2em] text-void transition-shadow hover:shadow-[0_0_28px_-4px_rgba(79,227,251,0.9)]"
          data-testid="cta-flight"
        >
          Proceed to flight test
          <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span>
        </Link>
      </aside>
    </div>
  );
}
