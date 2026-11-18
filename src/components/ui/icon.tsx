import type { SVGProps } from "react";

const glyphs = {
  hangar: (
    <>
      <path d="M3 21V9l9-6 9 6v12M3 21h18M8 21v-9h8v9M8 15h8M8 18h8" />
    </>
  ),
  flight: (
    <>
      <path d="M5 19 19 5l-3 14-3-6-6-3 12-5" />
      <path d="m8 16-3 3" />
    </>
  ),
  telemetry: (
    <>
      <path d="M3 12h4l3-6 4 12 3-6h4" />
    </>
  ),
  arrow: (
    <>
      <path d="M4 12h15m-6-6 6 6-6 6" />
    </>
  ),
  up: <path d="m5 15 7-7 7 7" />,
  down: <path d="m5 9 7 7 7-7" />,
  left: <path d="m15 5-7 7 7 7" />,
  right: <path d="m9 5 7 7-7 7" />,
  orbit: (
    <>
      <circle cx="12" cy="12" r="2" />
      <ellipse cx="12" cy="12" rx="10" ry="4.4" transform="rotate(-35 12 12)" />
      <path d="M4 16c1.7 2 5.4 2.1 9.3-.3" />
    </>
  ),
  light: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9l2 2m10.2 10.2 2 2M4.9 19.1l2-2M17.1 6.9l2-2" />
    </>
  ),
  play: <path d="m9 5 11 7-11 7Z" />,
  pause: (
    <>
      <path d="M9 5v14m6-14v14" />
    </>
  ),
  reset: (
    <>
      <path d="M5 8a8 8 0 1 1-.7 6M5 3v5h5" />
    </>
  ),
  boost: <path d="m13 2-8 12h6l-1 8 9-12h-6z" />,
  quality: (
    <>
      <path d="M4 18h3M4 13h8M4 8h13m0-2v4m-5 1v4m-5 1v4" />
    </>
  ),
  crosshair: (
    <>
      <circle cx="12" cy="12" r="7" />
      <path d="M12 2v5m0 10v5M2 12h5m10 0h5" />
    </>
  ),
  check: <path d="m5 12 5 5L20 7" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  archive: (
    <>
      <path d="M4 8h16v12H4zM3 4h18v4H3zM9 12h6" />
    </>
  ),
} as const;

export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: keyof typeof glyphs }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.55"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {glyphs[name]}
    </svg>
  );
}

export function AegisMark() {
  return (
    <svg viewBox="0 0 38 36" width="38" height="36" aria-hidden="true">
      <path d="M19 2 37 32h-9.6L19 16 10.6 32H1z" fill="currentColor" />
      <path d="M12.4 32 19 21l6.6 11z" fill="currentColor" opacity=".42" />
      <path d="M1 35h36" stroke="currentColor" opacity=".4" />
    </svg>
  );
}
