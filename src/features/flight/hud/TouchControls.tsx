"use client";

import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { setTouchBoost, setTouchStick, setTouchVertical } from "../input";

/**
 * On-screen flight controls for touch devices: a virtual stick for horizontal
 * movement plus hold buttons for climb / descend / boost. Pointer capture keeps
 * a drag tracking even when the finger leaves the element.
 */
export function TouchControls({ onInput }: { onInput: () => void }) {
  const knob = useRef<HTMLSpanElement>(null);
  const base = useRef<HTMLDivElement>(null);

  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = base.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const radius = r.width / 2;
    let dx = (e.clientX - (r.left + radius)) / radius;
    let dy = (e.clientY - (r.top + radius)) / radius;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    setTouchStick(Math.abs(dx) < 0.12 ? 0 : dx, Math.abs(dy) < 0.12 ? 0 : -dy);
    if (knob.current) knob.current.style.transform = `translate(${dx * radius * 0.6}px, ${dy * radius * 0.6}px)`;
    onInput();
  };
  const release = () => {
    setTouchStick(0, 0);
    if (knob.current) knob.current.style.transform = "translate(0px, 0px)";
  };

  const hold = (apply: (on: boolean) => void, label: string, glyph: string, testId: string, wide = false) => (
    <button
      type="button"
      aria-label={label}
      data-testid={testId}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        apply(true);
        onInput();
      }}
      onPointerUp={() => apply(false)}
      onPointerCancel={() => apply(false)}
      onLostPointerCapture={() => apply(false)}
      onContextMenu={(e) => e.preventDefault()}
      className={`panel-flat grid touch-none select-none place-items-center font-[family-name:var(--font-display)] text-[11px] uppercase tracking-[0.14em] text-steel-100 active:bg-ion-400/25 ${
        wide ? "h-12 w-20" : "h-12 w-12"
      }`}
    >
      {glyph}
    </button>
  );

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex items-end justify-between px-3" data-testid="touch-controls">
      <div
        ref={base}
        role="application"
        aria-label="Virtual stick: drag to move the drone horizontally"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          move(e);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) move(e);
        }}
        onPointerUp={release}
        onPointerCancel={release}
        className="pointer-events-auto relative grid h-32 w-32 touch-none select-none place-items-center rounded-full border border-ion-400/30 bg-graphite-950/55 backdrop-blur"
        data-testid="touch-stick"
      >
        <span className="absolute inset-4 rounded-full border border-dashed border-ion-400/15" aria-hidden="true" />
        <span ref={knob} className="h-12 w-12 rounded-full border border-ion-300/70 bg-ion-400/25 shadow-[0_0_18px_rgba(79,227,251,0.45)]" aria-hidden="true" />
      </div>
      <div className="pointer-events-auto grid grid-cols-2 gap-2">
        {hold((on) => setTouchVertical(on ? 1 : 0), "Ascend (hold)", "▲ E", "touch-up")}
        {hold(setTouchBoost, "Boost (hold)", "Boost", "touch-boost", true)}
        {hold((on) => setTouchVertical(on ? -1 : 0), "Descend (hold)", "▼ Q", "touch-down")}
      </div>
    </div>
  );
}
