"use client";

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Procedural geometry for the AX-7 "Kestrel" quadrotor. Built once per page
 * and shared by every drone instance (hangar + flight). Units are metres;
 * the nose points to −Z and +Y is up.
 */

export const ROTOR_POSITIONS: readonly [number, number, number][] = [
  [-0.46, 0.035, -0.4], // front-left (port)
  [0.46, 0.035, -0.4], // front-right (starboard)
  [-0.46, 0.035, 0.4], // rear-left
  [0.46, 0.035, 0.4], // rear-right
];
export const ARM_ROOTS: readonly [number, number, number][] = [
  [-0.12, 0, -0.15],
  [0.12, 0, -0.15],
  [-0.12, 0, 0.15],
  [0.12, 0, 0.15],
];
export const PROP_RADIUS = 0.235;
export const GUARD_RADIUS = 0.262;

/** Top-view outline of the fuselage (x = right, y = forward). */
function hullShape(scale = 1): THREE.Shape {
  const s = new THREE.Shape();
  const p = (x: number, y: number) => [x * scale, y * scale] as const;
  s.moveTo(...p(0, 0.38));
  s.quadraticCurveTo(...p(0.08, 0.37), ...p(0.13, 0.28));
  s.lineTo(...p(0.19, 0.1));
  s.quadraticCurveTo(...p(0.205, 0), ...p(0.19, -0.1));
  s.lineTo(...p(0.15, -0.3));
  s.quadraticCurveTo(...p(0.12, -0.36), ...p(0.05, -0.36));
  s.lineTo(...p(-0.05, -0.36));
  s.quadraticCurveTo(...p(-0.12, -0.36), ...p(-0.15, -0.3));
  s.lineTo(...p(-0.19, -0.1));
  s.quadraticCurveTo(...p(-0.205, 0), ...p(-0.19, 0.1));
  s.lineTo(...p(-0.13, 0.28));
  s.quadraticCurveTo(...p(-0.08, 0.37), ...p(0, 0.38));
  return s;
}

/** Extrude a top-view shape vertically, centred on y = 0. */
function verticalExtrude(
  shape: THREE.Shape,
  depth: number,
  bevel: number,
  segments = 3,
): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel * 0.8,
    bevelSegments: segments,
    curveSegments: 16,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, -depth / 2, 0);
  return g;
}

function armGeometry(length: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, -0.038);
  s.lineTo(length, -0.018);
  s.lineTo(length, 0.022);
  s.quadraticCurveTo(length * 0.5, 0.03, 0, 0.04);
  s.closePath();
  // Lightening holes.
  for (const [cx, rx] of [
    [length * 0.34, length * 0.1],
    [length * 0.62, length * 0.08],
  ] as const) {
    const h = new THREE.Path();
    h.absellipse(cx, 0.002, rx, 0.012, 0, Math.PI * 2, false, 0);
    s.holes.push(h);
  }
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.05,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 2,
    curveSegments: 12,
  });
  g.translate(0, 0, -0.025);
  return g;
}

/** One twisted propeller blade lying in the XZ plane, spanning +X. */
function bladeGeometry(direction: 1 | -1): THREE.BufferGeometry {
  const span = PROP_RADIUS;
  const s = new THREE.Shape();
  s.moveTo(0.02, -0.012);
  s.bezierCurveTo(span * 0.35, -0.03, span * 0.8, -0.02, span, -0.004);
  s.quadraticCurveTo(span + 0.006, 0.004, span - 0.004, 0.01);
  s.bezierCurveTo(span * 0.7, 0.02, span * 0.3, 0.024, 0.02, 0.012);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.004,
    bevelEnabled: true,
    bevelThickness: 0.0015,
    bevelSize: 0.0015,
    bevelSegments: 1,
    curveSegments: 10,
  });
  g.rotateX(-Math.PI / 2);
  // Twist: higher pitch at the root, flatter at the tip.
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const r = Math.max(0, v.x / span);
    const angle = direction * (0.38 - 0.26 * r);
    const y = v.y * Math.cos(angle) - v.z * Math.sin(angle);
    const z = v.y * Math.sin(angle) + v.z * Math.cos(angle);
    pos.setXYZ(i, v.x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

function propellerGeometry(direction: 1 | -1): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 3; i++) {
    const b = bladeGeometry(direction);
    b.rotateY((i * Math.PI * 2) / 3);
    parts.push(b);
  }
  const hub = new THREE.CylinderGeometry(0.022, 0.026, 0.018, 20);
  const nose = new THREE.SphereGeometry(0.016, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  nose.translate(0, 0.009, 0);
  parts.push(hub, nose);
  const merged = mergeGeometries(parts.map(stripUv));
  parts.forEach((p) => p.dispose());
  return merged;
}

/** mergeGeometries requires matching attribute sets; drop uv where not needed. */
function stripUv(g: THREE.BufferGeometry): THREE.BufferGeometry {
  if (g.index) g = g.toNonIndexed();
  for (const name of Object.keys(g.attributes))
    if (name !== "position" && name !== "normal") g.deleteAttribute(name);
  return g;
}

function guardGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const ring = new THREE.TorusGeometry(GUARD_RADIUS, 0.0085, 8, 72);
  ring.rotateX(Math.PI / 2);
  ring.translate(0, 0.045, 0);
  parts.push(ring);
  const lip = new THREE.TorusGeometry(GUARD_RADIUS + 0.002, 0.005, 6, 72);
  lip.rotateX(Math.PI / 2);
  lip.translate(0, 0.015, 0);
  parts.push(lip);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
    const strut = new THREE.BoxGeometry(GUARD_RADIUS - 0.06, 0.008, 0.012);
    strut.translate((GUARD_RADIUS - 0.06) / 2 + 0.06, 0.0, 0);
    strut.rotateY(a);
    parts.push(strut);
    const post = new THREE.CylinderGeometry(0.005, 0.005, 0.034, 6);
    post.translate(Math.cos(a) * GUARD_RADIUS, 0.03, -Math.sin(a) * GUARD_RADIUS);
    parts.push(post);
  }
  const merged = mergeGeometries(parts.map(stripUv));
  parts.forEach((p) => p.dispose());
  return merged;
}

function motorBaseGeometry(): THREE.BufferGeometry {
  const plate = new THREE.CylinderGeometry(0.068, 0.072, 0.012, 32);
  plate.translate(0, -0.012, 0);
  const stator = new THREE.CylinderGeometry(0.056, 0.06, 0.03, 32);
  stator.translate(0, 0.008, 0);
  const shaft = new THREE.CylinderGeometry(0.006, 0.006, 0.05, 8);
  shaft.translate(0, 0.045, 0);
  const merged = mergeGeometries([plate, stator, shaft].map(stripUv));
  return merged;
}

function skidGeometry(): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.205, -0.32),
    new THREE.Vector3(0, -0.255, -0.26),
    new THREE.Vector3(0, -0.272, -0.1),
    new THREE.Vector3(0, -0.272, 0.12),
    new THREE.Vector3(0, -0.255, 0.26),
    new THREE.Vector3(0, -0.21, 0.31),
  ]);
  return new THREE.TubeGeometry(curve, 48, 0.012, 10, false);
}

/** Cylinder from point a to point b. */
function strutBetween(a: THREE.Vector3, b: THREE.Vector3, r: number): THREE.BufferGeometry {
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r, r * 1.15, len, 10);
  const dir = new THREE.Vector3().subVectors(b, a).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  g.applyQuaternion(q);
  const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  g.translate(mid.x, mid.y, mid.z);
  return g;
}

function landingStrutsGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    for (const z of [-0.13, 0.13]) {
      parts.push(
        strutBetween(
          new THREE.Vector3(side * 0.1, -0.06, z * 0.9),
          new THREE.Vector3(side * 0.17, -0.265, z * 1.1),
          0.009,
        ),
      );
    }
    // Cross brace.
    parts.push(
      strutBetween(
        new THREE.Vector3(side * 0.16, -0.22, -0.14),
        new THREE.Vector3(side * 0.16, -0.22, 0.14),
        0.006,
      ),
    );
  }
  const merged = mergeGeometries(parts.map(stripUv));
  parts.forEach((p) => p.dispose());
  return merged;
}

function finsGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 9; i++) {
    const fin = new THREE.BoxGeometry(0.15, 0.03, 0.004);
    fin.translate(0, -0.105, 0.17 + i * 0.014);
    parts.push(fin);
  }
  return mergeGeometries(parts.map(stripUv));
}

function ventSlatsGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const s = new THREE.BoxGeometry(0.012, 0.004, 0.11);
      s.rotateZ(side * 0.5);
      s.translate(side * 0.196, 0.034 - i * 0.011, 0.02);
      parts.push(s);
    }
  }
  return mergeGeometries(parts.map(stripUv));
}

function panelSeamsGeometry(): THREE.BufferGeometry {
  // Raised panel lines on the dorsal shell.
  const parts: THREE.BufferGeometry[] = [];
  const add = (w: number, d: number, x: number, z: number, ry = 0) => {
    const b = new THREE.BoxGeometry(w, 0.004, d);
    b.rotateY(ry);
    b.translate(x, 0.093, z);
    parts.push(b);
  };
  add(0.004, 0.22, 0.09, 0.02, 0.06);
  add(0.004, 0.22, -0.09, 0.02, -0.06);
  add(0.18, 0.004, 0, 0.14);
  add(0.14, 0.004, 0, -0.1);
  add(0.004, 0.1, 0.05, 0.25);
  add(0.004, 0.1, -0.05, 0.25);
  return mergeGeometries(parts.map(stripUv));
}

export interface DroneGeometries {
  hullLower: THREE.BufferGeometry;
  hullUpper: THREE.BufferGeometry;
  waistRing: THREE.BufferGeometry;
  canopy: THREE.BufferGeometry;
  spine: THREE.BufferGeometry;
  lidarBase: THREE.BufferGeometry;
  lidarBand: THREE.BufferGeometry;
  battery: THREE.BufferGeometry;
  fins: THREE.BufferGeometry;
  vents: THREE.BufferGeometry;
  seams: THREE.BufferGeometry;
  noseSensor: THREE.BufferGeometry;
  eye: THREE.BufferGeometry;
  arm: THREE.BufferGeometry;
  armLength: number;
  armHub: THREE.BufferGeometry;
  armStrip: THREE.BufferGeometry;
  motorBase: THREE.BufferGeometry;
  bell: THREE.BufferGeometry;
  motorRing: THREE.BufferGeometry;
  propCW: THREE.BufferGeometry;
  propCCW: THREE.BufferGeometry;
  blurDisc: THREE.BufferGeometry;
  guard: THREE.BufferGeometry;
  led: THREE.BufferGeometry;
  skid: THREE.BufferGeometry;
  struts: THREE.BufferGeometry;
  footPad: THREE.BufferGeometry;
  gimbalYoke: THREE.BufferGeometry;
  gimbalBall: THREE.BufferGeometry;
  lens: THREE.BufferGeometry;
  lensRing: THREE.BufferGeometry;
  antenna: THREE.BufferGeometry;
  bolt: THREE.BufferGeometry;
}

let cached: DroneGeometries | null = null;

export function getDroneGeometries(): DroneGeometries {
  if (cached) return cached;

  const hullLower = verticalExtrude(hullShape(1), 0.07, 0.025);
  hullLower.translate(0, -0.015, 0);
  const hullUpper = verticalExtrude(hullShape(0.8), 0.045, 0.018);
  hullUpper.translate(0, 0.055, 0.02);

  const ringShape = hullShape(1.045);
  const inner = hullShape(1.0);
  ringShape.holes.push(new THREE.Path(inner.getPoints(48)));
  const waistRing = verticalExtrude(ringShape, 0.01, 0);
  waistRing.translate(0, 0.012, 0);

  const canopy = new THREE.SphereGeometry(0.12, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2);
  canopy.scale(0.85, 0.55, 1.45);
  canopy.translate(0, 0.085, -0.12);

  const spine = new THREE.BoxGeometry(0.07, 0.035, 0.2);
  spine.translate(0, 0.1, 0.12);

  const lidarBase = new THREE.CylinderGeometry(0.04, 0.046, 0.035, 28);
  lidarBase.translate(0, 0.13, 0.2);
  const lidarBand = new THREE.CylinderGeometry(0.0415, 0.0415, 0.009, 28, 1, true);
  lidarBand.translate(0, 0.137, 0.2);

  const battery = new THREE.BoxGeometry(0.17, 0.06, 0.16);
  battery.translate(0, -0.075, 0.22);

  const noseSensor = new THREE.CylinderGeometry(0.03, 0.05, 0.06, 6, 1);
  noseSensor.rotateX(Math.PI / 2);
  noseSensor.translate(0, 0.005, -0.38);
  const eye = new THREE.CylinderGeometry(0.011, 0.011, 0.012, 16);
  eye.rotateX(Math.PI / 2);

  const rootToRotor = Math.hypot(
    ROTOR_POSITIONS[0][0] - ARM_ROOTS[0][0],
    ROTOR_POSITIONS[0][2] - ARM_ROOTS[0][2],
  );
  const armLength = rootToRotor - 0.05;
  const arm = armGeometry(armLength);
  const armHub = new THREE.CylinderGeometry(0.04, 0.044, 0.085, 20);
  const armStrip = new THREE.BoxGeometry(armLength * 0.55, 0.004, 0.01);
  armStrip.translate(armLength * 0.42, 0.032, 0);

  const motorBase = motorBaseGeometry();
  const bell = new THREE.CylinderGeometry(0.05, 0.057, 0.034, 32);
  bell.translate(0, 0.04, 0);
  const motorRing = new THREE.TorusGeometry(0.0575, 0.0035, 6, 40);
  motorRing.rotateX(Math.PI / 2);
  motorRing.translate(0, 0.026, 0);

  const propCW = propellerGeometry(1);
  propCW.translate(0, 0.075, 0);
  const propCCW = propellerGeometry(-1);
  propCCW.translate(0, 0.075, 0);
  const blurDisc = new THREE.CircleGeometry(PROP_RADIUS, 48);
  blurDisc.rotateX(-Math.PI / 2);
  blurDisc.translate(0, 0.076, 0);

  const guard = guardGeometry();
  const led = new THREE.SphereGeometry(0.012, 12, 8);

  const skid = skidGeometry();
  const struts = landingStrutsGeometry();
  const footPad = new THREE.CylinderGeometry(0.02, 0.024, 0.012, 14);

  const gimbalYoke = mergeGeometries(
    [
      new THREE.BoxGeometry(0.1, 0.012, 0.04).translate(0, -0.05, 0),
      new THREE.BoxGeometry(0.008, 0.06, 0.03).translate(-0.05, -0.078, 0),
      new THREE.BoxGeometry(0.008, 0.06, 0.03).translate(0.05, -0.078, 0),
    ].map(stripUv),
  );
  const gimbalBall = new THREE.SphereGeometry(0.044, 28, 18);
  const lens = new THREE.CylinderGeometry(0.024, 0.028, 0.03, 24);
  lens.rotateX(Math.PI / 2);
  lens.translate(0, 0, -0.04);
  const lensRing = new THREE.TorusGeometry(0.026, 0.003, 6, 28);
  lensRing.translate(0, 0, -0.056);

  const antenna = new THREE.CylinderGeometry(0.003, 0.004, 0.13, 6);
  antenna.translate(0, 0.065, 0);

  const bolt = new THREE.CylinderGeometry(0.0075, 0.0075, 0.006, 6);

  cached = {
    hullLower,
    hullUpper,
    waistRing,
    canopy,
    spine,
    lidarBase,
    lidarBand,
    battery,
    fins: finsGeometry(),
    vents: ventSlatsGeometry(),
    seams: panelSeamsGeometry(),
    noseSensor,
    eye,
    arm,
    armLength,
    armHub,
    armStrip,
    motorBase,
    bell,
    motorRing,
    propCW,
    propCCW,
    blurDisc,
    guard,
    led,
    skid,
    struts,
    footPad,
    gimbalYoke,
    gimbalBall,
    lens,
    lensRing,
    antenna,
    bolt,
  };
  return cached;
}

/** Bolt positions (instanced): hull perimeter + arm hubs. */
export function boltMatrices(): THREE.Matrix4[] {
  const out: THREE.Matrix4[] = [];
  const m = new THREE.Matrix4();
  const shape = hullShape(0.86).getSpacedPoints(18);
  for (let i = 0; i < shape.length - 1; i++) {
    const p = shape[i];
    out.push(m.clone().makeTranslation(p.x, 0.08, -p.y));
  }
  for (const [x, , z] of ARM_ROOTS) {
    out.push(m.clone().makeTranslation(x - 0.015, 0.045, z));
    out.push(m.clone().makeTranslation(x + 0.015, 0.045, z));
  }
  return out;
}
