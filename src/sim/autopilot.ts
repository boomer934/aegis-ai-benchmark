import type { FlightInput } from "./physics";
import type { World } from "./mission";
import { clamp, type Vec3 } from "./vec";

/**
 * Simple waypoint autopilot that produces ordinary stick inputs — it has no
 * privileged access to the mission state. Used by unit tests to prove the
 * course can be flown and that checkpoints are detected from real movement.
 */
export interface Autopilot {
  input(w: World): FlightInput;
}

export function createCourseAutopilot(w: World, cruise = 0.85): Autopilot {
  const waypoints: Vec3[] = [];
  for (const g of w.arena.gates) {
    const n = g.normal;
    waypoints.push({ x: g.center.x - n.x * 6, y: g.center.y, z: g.center.z - n.z * 6 });
    waypoints.push({ x: g.center.x + n.x * 4, y: g.center.y, z: g.center.z + n.z * 4 });
  }
  let index = 0;
  return {
    input(world: World): FlightInput {
      const p = world.drone.position;
      while (index < waypoints.length - 1) {
        const t = waypoints[index];
        if (Math.hypot(t.x - p.x, t.y - p.y, t.z - p.z) < 2.2) index++;
        else break;
      }
      const t = waypoints[index];
      const dx = t.x - p.x;
      const dy = t.y - p.y;
      const dz = t.z - p.z;
      const dist = Math.hypot(dx, dz) || 1;
      const profile = world.profile;
      const speed = Math.min(profile.maxSpeed * cruise, dist * 1.6 + 3);
      const desiredVx = (dx / dist) * speed;
      const desiredVz = (dz / dist) * speed;
      const v = world.drone.velocity;
      const gain = 3 / profile.accel;
      return {
        x: clamp((desiredVx - v.x) * gain, -1, 1),
        z: clamp(-(desiredVz - v.z) * gain, -1, 1),
        y: clamp(dy * 0.6 - v.y * 0.3, -1, 1),
        boost: false,
      };
    },
  };
}
