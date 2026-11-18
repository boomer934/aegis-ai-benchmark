import type { CSSProperties } from "react";
const paths = {
  hangar: "M3 20V8l9-5 9 5v12H3Zm4 0v-9h10v9M7 14h10m-10 3h10",
  flight: "m4 19 6-15 4 9 6 2-16 4Zm6-15 1 11",
  telemetry: "M3 18V6m0 12h18M5 14l4-5 4 4 6-8",
  sliders: "M3 6h9m4 0h5M3 12h3m4 0h11M3 18h11m4 0h3M12 3v6m-6 0v6m8 0v6",
  arrow: "M4 12h15m-6-6 6 6-6 6",
  camera: "M3 7h4l2-3h6l2 3h4v13H3V7Zm13 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  rotate: "M20 11a8 8 0 1 0-2 6m2-14v8h-8",
  check: "m4 12 5 5L20 6",
  power: "M12 2v10M6 5a9 9 0 1 0 12 0",
  bulb: "M8 16h8m-7 3h6m-5 2h4M8 14c0-2-3-3-3-7a7 7 0 0 1 14 0c0 4-3 5-3 7",
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  wave: "M2 13h5l3-9 4 16 3-9h5",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  move: "M12 2v20M2 12h20M9 5l3-3 3 3m-6 14 3 3 3-3M5 9l-3 3 3 3m14-6 3 3-3 3",
  pause: "M7 4h3v16H7zM14 4h3v16h-3z",
  play: "m7 3 13 9-13 9V3Z",
  chip: "M5 5h14v14H5zM9 1v4m6-4v4M9 19v4m6-4v4M1 9h4m-4 6h4m14-6h4m-4 6h4",
  flag: "M5 21V4m0 1c5-4 9 4 15 0v9c-6 4-10-4-15 0",
  pulse: "M3 18h2v3H3zm5-5h2v8H8zm5-5h2v13h-2zm5-5h2v18h-2z",
  settings:
    "M12 3 15 5l3 .5 2 3-1 3 1 3-2 3-3 .5-3 2-3-2-3-.5-2-3 1-3-1-3 2-3L9 5l3-2Zm3 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
};
export function Icon({
  name,
  size = 17,
  style,
}: {
  name: keyof typeof paths;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.55"
      strokeLinejoin="round"
      strokeLinecap="round"
      style={style}
    >
      <path d={paths[name]} />
    </svg>
  );
}
export function Logo() {
  return (
    <svg aria-hidden="true" width="37" height="34" viewBox="0 0 42 38">
      <path fill="currentColor" d="M1 34 18 3h8L9 34zm15-7 5-9 9 16H20l-4-7Zm9-15 4-7 13 29h-7z" />
    </svg>
  );
}
export function AirframePlan() {
  return (
    <svg
      aria-label="Kestrel X4 airframe plan"
      role="img"
      viewBox="0 0 156 89"
      className="airframe-plan"
    >
      <g stroke="#597780" fill="none" strokeWidth=".65" opacity=".7">
        <path d="M0 44h156M79 2v85" strokeDasharray="3 3" />
        <path d="M21 12V7h112v5M13 17h-4v54h4" />
      </g>
      <g fill="#243139" stroke="#85a7ae" strokeWidth="1">
        {[
          [-1, -1],
          [-1, 1],
          [1, -1],
          [1, 1],
        ].map(([x, y]) => (
          <g key={x + ":" + y} transform={`translate(78 44) scale(${x} ${y})`}>
            <path d="m6 5 29 15 3-5L9 2Z" />
            <circle cx="40" cy="20" r="16" />
            <circle cx="40" cy="20" r="13" fill="#17252a" strokeWidth=".6" />
            <path d="m29 13 12 5 10 10-12-6Z" />
            <circle cx="40" cy="20" r="2.3" />
          </g>
        ))}
        <path d="m72 21 12 0 6 12-2 25-8 9-5-1-8-14 1-20Z" />
        <path d="m74 26 8 0 5 9-1 13-15 0 0-15Z" fill="#36484d" />
      </g>
    </svg>
  );
}
