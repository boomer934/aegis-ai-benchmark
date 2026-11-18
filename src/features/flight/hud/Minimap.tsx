"use client";

import { ARENA } from "@/sim/arena";
import { useFlight } from "@/stores/flightStore";

const B = ARENA.bounds;
const W = B.maxX - B.minX;
const H = B.maxZ - B.minZ;

/** Top-down tactical map drawn from the shared arena definition. */
export function Minimap() {
  const x = useFlight((s) => s.x);
  const z = useFlight((s) => s.z);
  const next = useFlight((s) => s.checkpoints);
  return (
    <svg
      viewBox={`${B.minX} ${B.minZ} ${W} ${H}`}
      className="h-full w-full"
      role="img"
      aria-label={`Arena map. Drone at x ${x.toFixed(0)}, z ${z.toFixed(0)}. Next gate ${Math.min(next + 1, 5)}.`}
      data-testid="minimap"
    >
      <rect
        x={B.minX}
        y={B.minZ}
        width={W}
        height={H}
        fill="rgba(79,227,251,0.04)"
        stroke="rgba(79,227,251,0.5)"
        strokeWidth={0.8}
      />
      {ARENA.obstacles.map((o) =>
        o.kind === "cylinder" ? (
          <circle key={o.id} cx={o.x} cy={o.z} r={o.radius} fill="rgba(169,183,193,0.55)" />
        ) : o.role === "gate-frame" ? null : (
          <rect
            key={o.id}
            x={o.center.x - o.half.x}
            y={o.center.z - o.half.z}
            width={o.half.x * 2}
            height={o.half.z * 2}
            fill={o.role === "beam" ? "rgba(255,159,28,0.25)" : "rgba(169,183,193,0.45)"}
            transform={`rotate(${(-o.yaw * 180) / Math.PI} ${o.center.x} ${o.center.z})`}
          />
        ),
      )}
      <polyline
        points={[ARENA.start, ...ARENA.gates.map((g) => g.center)]
          .map((p) => `${p.x},${p.z}`)
          .join(" ")}
        fill="none"
        stroke="rgba(79,227,251,0.35)"
        strokeWidth={0.7}
        strokeDasharray="2 2"
      />
      {ARENA.gates.map((g, i) => {
        const color = i < next ? "#3df2a5" : i === next ? "#4fe3fb" : "#ff9f1c";
        const rx = Math.cos(g.yaw) * g.halfWidth;
        const rz = -Math.sin(g.yaw) * g.halfWidth;
        return (
          <g key={g.number}>
            <line
              x1={g.center.x - rx}
              y1={g.center.z - rz}
              x2={g.center.x + rx}
              y2={g.center.z + rz}
              stroke={color}
              strokeWidth={i === next ? 2.2 : 1.4}
            />
            <text
              x={g.center.x + 6}
              y={g.center.z + 2}
              fill={color}
              fontSize={7}
              fontFamily="Consolas, monospace"
            >
              {g.number}
            </text>
          </g>
        );
      })}
      <circle cx={x} cy={z} r={3.2} fill="#ffffff" stroke="#4fe3fb" strokeWidth={1.2} />
    </svg>
  );
}
