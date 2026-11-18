"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import {
  Facility,
  useLayoutSettings,
  type Module,
  type Options,
  type Quality,
} from "@/stores/facility";
import { Config, CameraBar, HangarHud, Specs } from "./Hangar";
import { FlightConsole, FlightHud, FlightKeys } from "./FlightConsole";
import Telemetry from "./Telemetry";
import { Icon, Logo } from "./Marks";
const Viewport = dynamic(() => import("@/components/three/Viewport"), {
  ssr: false,
  loading: () => <div className="render-state">Loading 3D engine…</div>,
});
const nav = { hangar: "Hangar", flight: "Flight arena", telemetry: "Mission control" } as const;
function Runtime({ s }: { s: Facility }) {
  useEffect(() => {
    s.restore();
  }, [s]);
  const active = s.scene === "flight";
  useEffect(() => {
    let frame = 0,
      previous = performance.now();
    const loop = (now: number) => {
      const dt = (now - previous) / 1000;
      previous = now;
      if (!document.hidden) s.advance(dt);
      frame = requestAnimationFrame(loop);
    };
    if (active) frame = requestAnimationFrame(loop);
    const press = (e: KeyboardEvent, down: boolean) => {
      if (s.scene !== "flight" || e.altKey || e.metaKey || e.ctrlKey) return;
      const target = e.target as HTMLElement;
      if (target.matches("input, select, textarea, [contenteditable=true]")) return;
      const key = e.code.startsWith("Shift") ? "Shift" : e.code;
      if (["KeyA", "KeyD", "KeyW", "KeyS", "KeyQ", "KeyE", "Shift"].includes(key)) {
        e.preventDefault();
        if (down) s.keys.add(key);
        else s.keys.delete(key);
      }
      if (!down || e.repeat) return;
      if (
        key === "Space" &&
        !(target.closest("button") && target.closest(".key-group")) &&
        ["running", "paused"].includes(s.sim.state.phase)
      ) {
        e.preventDefault();
        s.togglePause();
      }
      if (key === "KeyR") {
        e.preventDefault();
        s.reset();
      }
    };
    const keydown = (e: KeyboardEvent) => press(e, true),
      keyup = (e: KeyboardEvent) => press(e, false);
    const inactive = () => {
      s.suspend();
      previous = performance.now();
    };
    const visibility = () => {
      if (document.hidden) inactive();
      else previous = performance.now();
    };
    const pop = () => {
      const targetScene = new URL(location.href).searchParams.get("scene");
      s.go(targetScene === "telemetry" || targetScene === "flight" ? targetScene : "hangar");
    };
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    window.addEventListener("blur", inactive);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("popstate", pop);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", inactive);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("popstate", pop);
    };
  }, [s, active]);
  return null;
}
function Graphics({ s, onDebug, debug }: { s: Facility; onDebug: () => void; debug: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        ref.current?.querySelector("button")?.focus();
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <div className="graphics" ref={ref}>
      <button
        className="graphics-toggle"
        aria-expanded={open}
        aria-label="Graphics settings"
        onClick={() => setOpen(!open)}
      >
        <Icon name="settings" />
        <span>Graphics</span>
      </button>
      {open && (
        <div className="graphics-popup">
          <strong>Graphics quality</strong>
          <div className="segments">
            {(["LOW", "MEDIUM", "HIGH"] as Quality[]).map((q) => (
              <button
                key={q}
                disabled={s.options.benchmark || s.options.perf}
                aria-pressed={s.settings.quality === q}
                onClick={() => s.configure({ quality: q })}
              >
                {q}
              </button>
            ))}
          </div>
          {(s.options.perf || s.options.benchmark) && (
            <small>Capture profile · HIGH / DPR 1.5</small>
          )}
          {!s.options.benchmark && (
            <button
              className="debug-toggle"
              disabled={s.options.perf}
              aria-pressed={debug}
              onClick={onDebug}
            >
              Performance panel · {debug ? "On" : "Off"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
export default function FacilityApp({ options }: { options: Options }) {
  const [s] = useState(() => new Facility(options));
  useLayoutSettings(s);
  const [debug, setDebug] = useState(options.perf && !options.benchmark);
  const go = (m: Module) => {
    if (m === s.scene) return;
    s.go(m);
    const url = new URL(location.href);
    url.searchParams.set("scene", m);
    history.pushState({}, "", url);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const flight = s.scene === "flight",
    tele = s.scene === "telemetry";
  return (
    <div className="app-shell">
      <Runtime s={s} />
      <header className="topbar">
        <div className="brand">
          <Logo />
          <span>AEGIS</span>
        </div>
        <span className="brand-sub">Drone test facility</span>
        <nav aria-label="Facility modules">
          {(Object.keys(nav) as Module[]).map((key) => (
            <button
              key={key}
              aria-current={s.scene === key ? "page" : undefined}
              onClick={() => go(key)}
            >
              <Icon name={key} />
              {nav[key]}
            </button>
          ))}
        </nav>
        <div className="system-status">
          <i />
          System online
        </div>
        <Graphics s={s} debug={debug} onDebug={() => setDebug(!debug)} />
      </header>
      <main>
        <div className="page-heading">
          <div>
            <h1>{tele ? "Mission control" : flight ? "Flight arena" : "Vehicle hangar"}</h1>
            <p>
              {tele
                ? "Review flight telemetry and local mission records."
                : flight
                  ? "Pilot the Kestrel through the indoor qualification circuit."
                  : "Inspect your airframe and configure it for flight."}
            </p>
          </div>
          <span className="location">
            <span className="loc-mark" />{" "}
            {tele
              ? s.options.benchmark
                ? "Deterministic demo data"
                : "Local telemetry"
              : flight
                ? "Test range / 02"
                : "Hangar bay / 04"}
          </span>
        </div>
        {tele ? (
          <Telemetry s={s} />
        ) : (
          <>
            <div className="workspace-grid">
              <section className="stage-column">
                <div className={"stage " + (flight ? "flight-stage" : "")}>
                  <Viewport key={s.scene} s={s} debug={debug} />
                  <div className="scene-shade" />
                  {flight ? <FlightHud s={s} /> : <HangarHud />}
                </div>
                {flight ? (
                  <div className="range-bar">
                    <Icon name="flag" />
                    {s.sim.state.gates === 5
                      ? "Circuit complete"
                      : "Target gate " + String(s.sim.state.gates + 1).padStart(2, "0")}
                    <span>Ordered circuit · 5 gates</span>
                  </div>
                ) : (
                  <CameraBar s={s} />
                )}
              </section>
              {flight && <FlightKeys s={s} />}{" "}
              {flight ? <FlightConsole s={s} /> : <Config s={s} launch={() => go("flight")} />}
            </div>
            {!flight && (
              <>
                <div className="orbit-hint">
                  <Icon name="move" size={14} />
                  Drag to orbit
                  <span />
                  Scroll or pinch to zoom
                </div>
                <Specs s={s} />
              </>
            )}
          </>
        )}
      </main>
      <footer>
        <span>
          <i />
          AEGIS <em>/</em> Facility console
        </span>
        <span>
          {tele ? "Data acquisition" : flight ? "Flight testing" : "Vehicle inspection"} <em>/</em>{" "}
          AX–04
        </span>
      </footer>
    </div>
  );
}
