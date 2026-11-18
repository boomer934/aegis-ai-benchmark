import type { Gate } from "./arena";
import type { Vec3 } from "./vec";

/**
 * True when the swept segment a→b passes through the gate's opening in the
 * valid direction (along the gate normal). Uses a plane sweep, so it cannot be
 * skipped by a fast drone, and flying through backwards does not count.
 */
export function segmentCrossesGate(gate: Gate, a: Readonly<Vec3>, b: Readonly<Vec3>): boolean {
  const { center: c, normal: n } = gate;
  const da = (a.x - c.x) * n.x + (a.y - c.y) * n.y + (a.z - c.z) * n.z;
  const db = (b.x - c.x) * n.x + (b.y - c.y) * n.y + (b.z - c.z) * n.z;
  if (!(da < 0 && db >= 0)) return false;
  const t = da / (da - db);
  const ix = a.x + (b.x - a.x) * t - c.x;
  const iy = a.y + (b.y - a.y) * t - c.y;
  const iz = a.z + (b.z - a.z) * t - c.z;
  // Gate-local right axis = (cos yaw, 0, −sin yaw).
  const lateral = ix * Math.cos(gate.yaw) - iz * Math.sin(gate.yaw);
  return Math.abs(lateral) <= gate.halfWidth && Math.abs(iy) <= gate.halfHeight;
}

export type GateCrossing =
  | { kind: "none" }
  | { kind: "checkpoint"; gateIndex: number }
  | { kind: "wrong-gate"; gateIndex: number };

/**
 * Evaluate a movement segment against the course. Only the next gate in order
 * scores; passing any other gate is reported as `wrong-gate` and ignored.
 */
export function evaluateGateCrossing(
  gates: readonly Gate[],
  nextGate: number,
  a: Readonly<Vec3>,
  b: Readonly<Vec3>,
): GateCrossing {
  if (nextGate < gates.length && segmentCrossesGate(gates[nextGate], a, b)) {
    return { kind: "checkpoint", gateIndex: nextGate };
  }
  for (let i = 0; i < gates.length; i++) {
    if (i !== nextGate && segmentCrossesGate(gates[i], a, b)) return { kind: "wrong-gate", gateIndex: i };
  }
  return { kind: "none" };
}
