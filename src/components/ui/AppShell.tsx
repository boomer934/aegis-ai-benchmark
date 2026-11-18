"use client";

import Link from "next/link";
import { useEffect } from "react";
import { QUALITY_IDS, type QualityId } from "@/domain/config";
import { modeQuery, type RuntimeMode } from "@/lib/runtime";
import { configStore, hydrateConfig, useConfig } from "@/stores/configStore";
import { useFlight } from "@/stores/flightStore";
import { RuntimeContext } from "./RuntimeContext";

export type ModuleId = "hangar" | "flight" | "control";

const MODULES: { id: ModuleId; href: string; index: string; label: string; short: string }[] = [
  { id: "hangar", href: "/hangar", index: "01", label: "Hangar", short: "Hangar" },
  { id: "flight", href: "/flight", index: "02", label: "Flight Test", short: "Flight" },
  { id: "control", href: "/control", index: "03", label: "Mission Control", short: "Control" },
];

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
        <path d="M16 2 29 9.5v13L16 30 3 22.5v-13Z" fill="none" stroke="#4fe3fb" strokeWidth="1.4" />
        <path d="M16 8 23 12v8l-7 4-7-4v-8Z" fill="#4fe3fb" fillOpacity="0.14" stroke="#4fe3fb" strokeWidth="1" />
        <circle cx="16" cy="16" r="2.4" fill="#ff9f1c" />
      </svg>
      <div className="leading-none">
        <div className="font-[family-name:var(--font-display)] text-[17px] font-semibold tracking-[0.42em] text-steel-100">
          AEGIS
        </div>
        <div className="label mt-1 hidden !text-[9px] sm:block">Drone Test Facility</div>
      </div>
    </div>
  );
}

function QualitySelector({ locked }: { locked: boolean }) {
  const quality = useConfig((s) => s.quality);
  return (
    <div role="radiogroup" aria-label="Graphics quality" className="flex items-center gap-1" data-testid="quality-selector">
      <span className="label mr-1 hidden lg:inline">GFX</span>
      {QUALITY_IDS.map((q: QualityId) => (
        <button
          key={q}
          type="button"
          role="radio"
          aria-checked={quality === q}
          disabled={locked}
          title={locked ? "Quality is fixed to HIGH in benchmark/perf mode" : `${q} graphics quality`}
          onClick={() => configStore.set({ quality: q })}
          className="seg-btn border border-graphite-600 px-2 py-1 text-[10px] text-steel-300 hover:border-ion-500 hover:text-steel-100 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {q === "MEDIUM" ? "MED" : q}
        </button>
      ))}
    </div>
  );
}

function FlightStatusChip() {
  const status = useFlight((s) => s.status);
  const hasSession = useFlight((s) => s.hasSession);
  if (!hasSession) return null;
  const tone =
    status === "running" || status === "countdown"
      ? "text-ion-300 border-ion-600"
      : status === "success"
        ? "text-signal-green border-signal-green/50"
        : status === "failed"
          ? "text-signal-red border-signal-red/50"
          : "text-amber-400 border-amber-500/50";
  return (
    <span className={`label hidden border px-2 py-1 !text-[9px] md:inline ${tone}`} data-testid="shell-flight-status">
      SIM {status}
    </span>
  );
}

export function AppShell({
  mode,
  active,
  children,
}: {
  mode: RuntimeMode;
  active: ModuleId;
  children: React.ReactNode;
}) {
  const showPerf = useConfig((s) => s.showPerf);
  const measurement = mode.benchmark || mode.perf;
  const q = modeQuery(mode);

  useEffect(() => {
    hydrateConfig({ benchmark: mode.benchmark, forceQuality: measurement ? "HIGH" : undefined });
    if (mode.perf) configStore.set({ showPerf: true });
  }, [mode.benchmark, mode.perf, measurement]);

  return (
    <RuntimeContext.Provider value={mode}>
      <div className="flex min-h-[100dvh] flex-col bg-void" data-module={active}>
        <a
          href="#main"
          className="sr-only z-50 bg-ion-400 px-3 py-2 text-void focus:not-sr-only focus:fixed focus:left-2 focus:top-2"
        >
          Skip to content
        </a>
        <header className="relative z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-ion-400/10 bg-graphite-950/90 px-4 backdrop-blur md:px-6">
          <Link href={`/hangar${q}`} aria-label="AEGIS home — hangar" className="shrink-0">
            <Logo />
          </Link>

          <nav aria-label="Modules" className="hidden h-full items-stretch md:flex">
            {MODULES.map((m) => {
              const isActive = m.id === active;
              return (
                <Link
                  key={m.id}
                  href={`${m.href}${q}`}
                  aria-current={isActive ? "page" : undefined}
                  data-testid={`nav-${m.id}`}
                  className={`group relative flex items-center gap-2 px-5 font-[family-name:var(--font-display)] text-[13px] uppercase tracking-[0.2em] transition-colors ${
                    isActive ? "text-steel-100" : "text-steel-400 hover:text-steel-200"
                  }`}
                >
                  <span className={`font-mono text-[10px] ${isActive ? "text-amber-500" : "text-graphite-600 group-hover:text-steel-400"}`}>
                    {m.index}
                  </span>
                  {m.label}
                  <span
                    aria-hidden="true"
                    className={`absolute inset-x-3 bottom-0 h-[2px] transition-all ${
                      isActive ? "bg-ion-400 shadow-[0_0_12px_rgba(79,227,251,0.8)]" : "bg-transparent"
                    }`}
                  />
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 md:gap-3">
            <FlightStatusChip />
            <QualitySelector locked={measurement} />
            {!mode.benchmark && (
              <button
                type="button"
                aria-pressed={showPerf}
                onClick={() => configStore.set({ showPerf: !showPerf })}
                className="seg-btn hidden border border-graphite-600 px-2 py-1 text-[10px] text-steel-300 hover:border-ion-500 sm:inline-block"
                title="Toggle developer performance panel"
                data-testid="perf-toggle"
              >
                Perf
              </button>
            )}
          </div>
        </header>

        <main id="main" className="relative flex min-h-0 flex-1 flex-col pb-16 md:pb-0">
          {children}
        </main>

        <nav
          aria-label="Modules"
          className="fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-3 border-t border-ion-400/10 bg-graphite-950/95 backdrop-blur md:hidden"
        >
          {MODULES.map((m) => {
            const isActive = m.id === active;
            return (
              <Link
                key={m.id}
                href={`${m.href}${q}`}
                aria-current={isActive ? "page" : undefined}
                data-testid={`mnav-${m.id}`}
                className={`relative flex flex-col items-center justify-center gap-0.5 font-[family-name:var(--font-display)] text-[11px] uppercase tracking-[0.18em] ${
                  isActive ? "text-ion-300" : "text-steel-400"
                }`}
              >
                <span className={`font-mono text-[9px] ${isActive ? "text-amber-500" : "text-graphite-600"}`}>{m.index}</span>
                {m.short}
                {isActive && <span aria-hidden="true" className="absolute inset-x-6 top-0 h-[2px] bg-ion-400" />}
              </Link>
            );
          })}
        </nav>
      </div>
    </RuntimeContext.Provider>
  );
}
