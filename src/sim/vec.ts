/** Minimal allocation-free 3D vector helpers for the deterministic simulation. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const vec3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });

export const copyVec = (out: Vec3, v: Readonly<Vec3>): Vec3 => {
  out.x = v.x;
  out.y = v.y;
  out.z = v.z;
  return out;
};

export const lengthXZ = (v: Readonly<Vec3>): number => Math.hypot(v.x, v.z);
export const length3 = (v: Readonly<Vec3>): number => Math.hypot(v.x, v.y, v.z);

export const distance3 = (a: Readonly<Vec3>, b: Readonly<Vec3>): number =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

export const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;

/** Frame-rate independent exponential approach factor for a smoothing rate (1/s). */
export const approachFactor = (rate: number, dt: number): number => 1 - Math.exp(-rate * dt);
