"use client";

import type { ReactNode } from "react";

/** Small shared UI primitives (segmented control, toggle, section header, stat bar). */

export function SectionTitle({
  index,
  children,
  aside,
}: {
  index: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 font-[family-name:var(--font-display)] text-[12px] uppercase tracking-[0.22em] text-steel-200">
        <span className="font-mono text-[10px] text-amber-500">{index}</span>
        {children}
      </h2>
      {aside}
    </div>
  );
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  testId,
  disabled,
}: {
  label: string;
  options: { value: T; label: string; hint?: string }[];
  value: T;
  onChange: (v: T) => void;
  testId?: string;
  disabled?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid gap-1.5"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      data-testid={testId}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={disabled}
          title={o.hint}
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => {
            const idx = options.findIndex((x) => x.value === value);
            if (e.key === "ArrowRight" || e.key === "ArrowDown") {
              e.preventDefault();
              onChange(options[(idx + 1) % options.length].value);
            } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
              e.preventDefault();
              onChange(options[(idx - 1 + options.length) % options.length].value);
            }
          }}
          data-value={o.value}
          className="seg-btn min-h-9 border border-graphite-600 bg-graphite-900/60 px-2 py-2 text-[11px] text-steel-300 hover:border-ion-500/70 hover:text-steel-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
  testId,
  description,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  testId?: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      data-testid={testId}
      className="group flex w-full items-center justify-between gap-3 border border-graphite-600 bg-graphite-900/60 px-3 py-2 text-left hover:border-ion-500/60"
    >
      <span>
        <span className="block font-[family-name:var(--font-display)] text-[12px] uppercase tracking-[0.16em] text-steel-100">
          {label}
        </span>
        {description && (
          <span className="mt-0.5 block text-[11px] text-steel-400">{description}</span>
        )}
      </span>
      <span
        aria-hidden="true"
        className={`relative h-5 w-9 shrink-0 border transition-colors ${checked ? "border-ion-400 bg-ion-400/25" : "border-graphite-600 bg-graphite-800"}`}
      >
        <span
          className={`absolute top-0.5 h-3.5 w-3.5 transition-all ${checked ? "left-[18px] bg-ion-300 shadow-[0_0_10px_rgba(79,227,251,0.9)]" : "left-0.5 bg-steel-400"}`}
        />
      </span>
    </button>
  );
}

export function StatBar({
  label,
  value,
  display,
  tone = "ion",
}: {
  label: string;
  value: number;
  display: string;
  tone?: "ion" | "amber";
}) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="grid grid-cols-[88px_1fr_56px] items-center gap-2">
      <span className="label !text-[9px]">{label}</span>
      <span className="relative h-1.5 bg-graphite-700" aria-hidden="true">
        <span
          className={`absolute inset-y-0 left-0 transition-[width] duration-500 ${tone === "ion" ? "bg-ion-400" : "bg-amber-500"}`}
          style={{ width: `${pct}%` }}
        />
        {[25, 50, 75].map((t) => (
          <span
            key={t}
            className="absolute inset-y-0 w-px bg-graphite-900"
            style={{ left: `${t}%` }}
          />
        ))}
      </span>
      <span className="readout text-right text-[12px] text-steel-200">{display}</span>
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex min-w-6 items-center justify-center border border-graphite-600 bg-graphite-800 px-1.5 py-0.5 font-mono text-[10px] text-steel-200 shadow-[inset_0_-1px_0_rgba(0,0,0,0.6)]">
      {children}
    </kbd>
  );
}
