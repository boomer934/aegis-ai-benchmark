import * as T from "three";
import { Fabricator, alloy, luminous, decal, type Triple } from "./fabrication";
// Eight longitudinal chines define the upper shoulder, belt line and recessed belly.
function shell(stations: number[][]) {
  const vertices: number[] = [];
  const rings = stations.map(([z, w, base, top]) => [
    [-w * 0.7, top, z],
    [w * 0.7, top, z],
    [w, top - 0.1, z],
    [w, base + 0.09, z],
    [w * 0.72, base, z],
    [-w * 0.72, base, z],
    [-w, base + 0.09, z],
    [-w, top - 0.1, z],
  ]);
  const triangle = (a: number[], b: number[], c: number[]) => vertices.push(...a, ...b, ...c);
  for (let i = 0; i < rings.length - 1; i++)
    for (let j = 0; j < 8; j++) {
      const k = (j + 1) % 8;
      triangle(rings[i][j], rings[i + 1][j], rings[i][k]);
      triangle(rings[i][k], rings[i + 1][j], rings[i + 1][k]);
    }
  for (let j = 1; j < 7; j++) {
    triangle(rings[0][0], rings[0][j], rings[0][j + 1]);
    const last = rings.at(-1)!;
    triangle(last[0], last[j + 1], last[j]);
  }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
  g.computeVertexNormals();
  return g;
}
function foil(points: number[][], height: number) {
  const s = new T.Shape();
  points.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  const g = new T.ExtrudeGeometry(s, {
    depth: height,
    bevelEnabled: true,
    bevelSegments: 1,
    steps: 1,
    bevelSize: 0.012,
    bevelThickness: 0.012,
  });
  g.rotateX(-Math.PI / 2);
  return g;
}
export function airframe() {
  const b = new Fabricator(),
    group = new T.Group(),
    rotors: T.Group[] = [];
  const armor = alloy("#f27a28", 0.36, 0.46),
    ceramic = alloy("#bcc5c7", 0.38, 0.49),
    titanium = alloy("#879ca5", 0.87, 0.29),
    rubber = alloy("#171c21", 0.12, 0.69),
    carbon = alloy("#2a3237", 0.59, 0.33),
    dark = alloy("#11191d", 0.74, 0.27),
    glass = alloy("#103947", 0.83, 0.12),
    copper = alloy("#ad622e", 0.78, 0.32),
    lamp = luminous("#89f2ff", 2),
    tail = luminous("#ff763d", 1.3);
  const stations = [
    [-1.43, 0.31, 0.04, 0.32],
    [-1.13, 0.65, -0.17, 0.56],
    [-0.5, 0.78, -0.25, 0.67],
    [0.48, 0.74, -0.25, 0.58],
    [1.1, 0.52, -0.13, 0.41],
    [1.48, 0.3, -0.02, 0.19],
  ];
  b.part(shell(stations), dark);
  b.part(
    shell([
      [-1.28, 0.34, 0.27, 0.43],
      [-1.0, 0.58, 0.36, 0.63],
      [-0.42, 0.65, 0.46, 0.75],
      [0.28, 0.58, 0.4, 0.67],
      [0.64, 0.43, 0.32, 0.53],
    ]),
    armor,
  );
  b.part(
    shell([
      [0.65, 0.43, 0.3, 0.51],
      [0.96, 0.44, 0.22, 0.42],
      [1.49, 0.27, 0.04, 0.24],
      [1.53, 0.23, 0.04, 0.17],
    ]),
    ceramic,
    [0, 0.085, 0],
  );
  // The removable dorsal equipment tray sits proud of the painted outer shell.
  b.part(
    shell([
      [-1.17, 0.23, 0.48, 0.59],
      [-0.94, 0.29, 0.57, 0.69],
      [-0.63, 0.25, 0.62, 0.78],
      [-0.49, 0.18, 0.65, 0.79],
    ]),
    carbon,
  );
  for (const sx of [-1, 1]) {
    b.part(
      shell([
        [-0.72, 0.07, 0.62, 0.72],
        [-0.44, 0.08, 0.66, 0.8],
        [0.16, 0.06, 0.59, 0.72],
        [0.47, 0.035, 0.5, 0.65],
      ]),
      armor,
      [sx * 0.395, 0, 0],
    );
    for (const z of [-0.38, 0.12])
      b.cylinder([sx * 0.39, 0.8 - (z + 0.38) * 0.15, z], 0.036, 0.036, 0.018, titanium, 8);
    b.part(
      shell([
        [-0.87, 0.1, 0.24, 0.43],
        [-0.61, 0.14, 0.25, 0.49],
        [0.07, 0.13, 0.23, 0.45],
        [0.29, 0.06, 0.23, 0.39],
      ]),
      carbon,
      [sx * 0.64, 0, 0],
    );
    for (let i = 0; i < 6; i++)
      b.box([sx * 0.74, 0.37, -0.62 + i * 0.117], [0.05, 0.19, 0.035], titanium, [0.32, 0, 0]);
    b.box([sx * 0.65, 0.14, -0.1], [0.18, 0.3, 1.24], carbon, [0, 0, sx * -0.15]);
    for (let i = 0; i < 9; i++)
      b.box([sx * 0.755, 0.17, -0.66 + i * 0.12], [0.04, 0.19, 0.046], titanium, [0.3, 0, 0]);
    b.part(
      shell([
        [-0.85, 0.075, 0.18, 0.38],
        [-0.42, 0.105, 0.16, 0.46],
        [0.32, 0.092, 0.13, 0.41],
        [0.81, 0.055, 0.11, 0.28],
      ]),
      ceramic,
      [sx * 0.69, 0, 0],
    );
    for (const z of [-0.72, -0.3, 0.19, 0.58])
      b.cylinder([sx * 0.69, 0.42 - Math.max(0, z) * 0.12, z], 0.037, 0.037, 0.032, titanium, 6);
    b.part(
      shell([
        [0.72, 0.09, 0.15, 0.31],
        [0.92, 0.085, 0.13, 0.28],
        [1.24, 0.06, 0.07, 0.2],
      ]),
      carbon,
      [sx * 0.41, 0, 0],
    );
    b.box([sx * 0.42, 0.2, 1.13], [0.128, 0.052, 0.26], lamp, [0.29, sx * -0.25, 0]);
    b.rod([sx * 0.32, 0.61, -0.93], [sx * 0.39, 0.73, -0.41], 0.024, titanium);
    b.rod([sx * 0.39, 0.73, -0.41], [sx * 0.32, 0.67, 0.25], 0.023, titanium);
    b.rod([sx * 0.23, 0.52, -1], [sx * 0.34, 0.94, -1.53], 0.024, titanium);
    b.cylinder([sx * 0.34, 0.95, -1.53], 0.045, 0.035, 0.1, rubber, 12);
    for (const sz of [-1, 1]) {
      const x = sx * 1.93,
        z = sz * 1.38;
      b.rod([sx * 0.51, 0.08, sz * 0.45], [x, 0.25, z], 0.145, carbon, 8);
      b.rod([sx * 0.55, 0.26, sz * 0.75], [x, 0.3, z], 0.088, titanium, 8);
      b.rod([sx * 0.57, -0.05, sz * 0.3], [x, 0.14, z], 0.051, copper);
      const yaw = -Math.atan2(sz * 0.86, sx * 1.35);
      b.part(
        foil(
          [
            [0.02, -0.18],
            [0.31, -0.2],
            [1.1, -0.1],
            [1.29, -0.04],
            [1.24, 0.055],
            [0.58, 0.11],
            [0.19, 0.18],
          ],
          0.058,
        ),
        carbon,
        [sx * 0.55, 0.238, sz * 0.5],
        [0, yaw, 0],
      );
      b.part(
        foil(
          [
            [0.26, -0.164],
            [0.56, -0.14],
            [1.03, -0.066],
            [0.99, 0.045],
            [0.51, 0.074],
            [0.29, 0.1],
          ],
          0.022,
        ),
        ceramic,
        [sx * 0.55, 0.315, sz * 0.5],
        [0, yaw, 0],
      );
      b.part(
        foil(
          [
            [0.72, -0.109],
            [0.81, -0.1],
            [0.84, 0.05],
            [0.75, 0.055],
          ],
          0.009,
        ),
        armor,
        [sx * 0.55, 0.35, sz * 0.5],
        [0, yaw, 0],
      );
      b.cylinder([sx * 0.72, 0.17, sz * 0.66], 0.21, 0.19, 0.31, rubber, 12);
      b.cylinder([sx * 0.72, 0.34, sz * 0.66], 0.12, 0.14, 0.05, titanium, 8);
      b.cylinder([x, 0.29, z], 0.245, 0.17, 0.47, dark);
      for (let n = 0; n < 4; n++)
        b.cylinder([x, 0.19 + n * 0.068, z], 0.24, 0.24, 0.024, n === 2 ? copper : titanium);
      b.cylinder([x, 0.54, z], 0.14, 0.23, 0.14, ceramic);
      for (let j = 0; j < 12; j++) {
        const a = (j * Math.PI) / 6;
        b.rod(
          [x + Math.sin(a) * 0.185, 0.15, z + Math.cos(a) * 0.185],
          [x + Math.sin(a + 0.25) * 0.205, 0.43, z + Math.cos(a + 0.25) * 0.205],
          0.019,
          copper,
          5,
        );
      }
      b.cylinder([x, 0.44, z], 0.235, 0.235, 0.045, armor, 24);
      // Split shrouds expose the fan tips and the three radial attachment points.
      const angle = sx > 0 ? -0.93 : 2.21;
      b.arc([x, 0.45, z], 0.9, 0.046, titanium, angle, 4.55);
      b.arc([x, 0.49, z], 0.9, 0.03, carbon, angle, 4.55);
      b.arc([x, 0.454, z], 0.902, 0.055, armor, angle + 0.2, 0.62, 14);
      for (const a of [angle + 0.1, angle + 2.15, angle + 4.38])
        b.rod([x, 0.2, z], [x + Math.cos(a) * 0.9, 0.45, z - Math.sin(a) * 0.9], 0.031, carbon);
      const fan = new Fabricator();
      for (let i = 0; i < 3; i++) {
        const rotation: Triple = [0, (i * Math.PI * 2) / 3, 0];
        fan.part(
          foil(
            [
              [0.08, -0.06],
              [0.35, -0.11],
              [0.71, -0.055],
              [0.85, 0.04],
              [0.82, 0.14],
              [0.48, 0.1],
              [0.16, 0.075],
            ],
            0.024,
          ),
          carbon,
          [0, 0, 0],
          rotation,
        );
        fan.part(
          foil(
            [
              [0.67, -0.046],
              [0.74, -0.03],
              [0.78, 0.13],
              [0.71, 0.12],
            ],
            0.003,
          ),
          ceramic,
          [0, 0.033, 0],
          rotation,
        );
      }
      fan.cylinder([0, 0.035, 0], 0.075, 0.14, 0.11, titanium, 12);
      const rotor = fan.finish();
      rotor.position.set(x, 0.62, z);
      rotor.rotation.y = sz * 0.6 + sx * 0.4;
      rotors.push(rotor);
      group.add(rotor);
      b.rod([sx * 0.69, -0.08, sz * 0.71], [sx * 1.03, -0.77, sz * 1.05], 0.068, titanium);
      b.rod([sx * 0.5, -0.13, sz * 0.41], [sx * 1.03, -0.75, sz * 1.03], 0.045, carbon);
      b.box([sx * 1.03, -0.81, sz * 1.07], [0.16, 0.12, 0.46], rubber);
      b.cylinder([x, 0.045, z], 0.075, 0.095, 0.04, sz === 1 ? lamp : tail, 16);
    }
    b.rod([sx * 1.03, -0.79, -1.15], [sx * 1.03, -0.79, 1.15], 0.049, dark);
  }
  for (let i = 0; i < 6; i++)
    b.box([0, 0.708 - i * 0.009, -0.6 - i * 0.07], [0.45, 0.037, 0.042], rubber);
  b.part(
    new T.PlaneGeometry(0.57, 0.19),
    decal("AX–04", "#e87d36", "#17242a"),
    [0, 0.716, 0.003],
    [-1.43, 0, 0],
  );
  const warning = decal("LIFT   /   04", "#243036", "#ccd5d6");
  b.part(new T.PlaneGeometry(0.4, 0.095), warning, [0, 0.5, 1.02], [-1.24, 0, 0]);
  b.box([0, 0.125, 1.54], [0.39, 0.068, 0.035], dark);
  b.box([0, 0.133, 1.563], [0.3, 0.024, 0.01], lamp);
  for (const side of [-1, 1]) {
    b.box([side * 0.32, -0.325, 0.89], [0.07, 0.31, 0.21], titanium, [0.12, 0, side * 0.12]);
    b.part(
      new T.CylinderGeometry(0.115, 0.115, 0.09, 20),
      carbon,
      [side * 0.3, -0.44, 0.89],
      [0, 0, Math.PI / 2],
    );
    b.part(
      new T.CylinderGeometry(0.055, 0.055, 0.012, 6),
      copper,
      [side * 0.355, -0.44, 0.89],
      [0, 0, Math.PI / 2],
    );
  }
  b.cylinder([0, -0.24, 0.82], 0.18, 0.15, 0.18, titanium);
  b.part(new T.SphereGeometry(0.295, 24, 16), carbon, [0, -0.43, 0.85], [0, 0, 0], [1, 0.88, 1.06]);
  for (const [z, r, h, m] of [
    [1.08, 0.18, 0.11, titanium],
    [1.16, 0.15, 0.065, dark],
    [1.2, 0.115, 0.022, glass],
    [1.216, 0.055, 0.009, lamp],
  ] as const)
    b.part(new T.CylinderGeometry(r, r, h, 32), m, [0, -0.45, z], [Math.PI / 2, 0, 0]);
  group.add(b.finish());
  return { group, rotors, armor, lamp, tail };
}
