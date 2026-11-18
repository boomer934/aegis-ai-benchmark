import * as T from "three";
import { Fabricator, alloy, luminous, surface, decal, seeded } from "./fabrication";
import { GATES, GATE_RADIUS, OBSTACLES } from "@/features/flight/simulation";

function padMaterial() {
  const map = surface(1536, 1536, (c) => {
    const size = 1536;
    const rnd = seeded(71);
    c.fillStyle = "#525e63";
    c.fillRect(0, 0, size, size);
    for (let i = 0; i < 50000; i++) {
      c.fillStyle = i % 2 ? "#ffffff0d" : "#00000013";
      c.fillRect(rnd() * size, rnd() * size, rnd() * 2 + 1, 1);
    }
    c.translate(768, 768);
    const ring = (r: number, color: string, width: number, a = 0, b = Math.PI * 2) => {
      c.beginPath();
      c.strokeStyle = color;
      c.lineWidth = width;
      c.arc(0, 0, r, a, b);
      c.stroke();
    };
    for (let i = 0; i < 16; i++) {
      c.save();
      c.rotate((i * Math.PI) / 8);
      c.strokeStyle = "#283337";
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(0, 340);
      c.lineTo(0, 755);
      c.stroke();
      c.fillStyle = "#20282a";
      c.fillRect(8, 670, 6, 15);
      for (let j = 0; j < 4; j++) {
        c.fillStyle = "#829093";
        c.fillRect(12 + j * 8, 607, 4, 12);
      }
      c.restore();
      ring(
        689,
        i % 4 === 0 ? "#dc8649" : "#9eaaab",
        9,
        (i * Math.PI) / 8 + 0.02,
        ((i + 1) * Math.PI) / 8 - 0.06,
      );
    }
    [345, 350, 545, 650, 710, 727].forEach((v, i) =>
      ring(v, i === 2 ? "#98a2a4" : "#303e43", i === 2 ? 4 : 2),
    );
    for (let i = 0; i < 120; i++)
      ring(
        703,
        i % 10 === 0 ? "#e1ab74" : "#748588",
        i % 10 === 0 ? 13 : 6,
        (i * Math.PI) / 60,
        (i * Math.PI) / 60 + 0.009,
      );
    c.fillStyle = "#aab5b6";
    c.textAlign = "center";
    c.font = "bold 63px Arial";
    c.fillText("04", 0, 512);
    c.rotate(Math.PI);
    c.font = "bold 26px monospace";
    c.fillText("LIFT CLEARANCE", 0, 480);
  });
  return new T.MeshStandardMaterial({ map, metalness: 0.53, roughness: 0.55 });
}
function floor() {
  const map = surface(512, 512, (c) => {
    c.fillStyle = "#3c474d";
    c.fillRect(0, 0, 512, 512);
    c.strokeStyle = "#202a30";
    c.lineWidth = 5;
    c.strokeRect(0, 0, 512, 512);
    c.fillStyle = "#1c2528";
    for (const x of [8, 504])
      for (const y of [8, 504]) {
        c.beginPath();
        c.arc(x, y, 2, 0, 7);
        c.fill();
      }
    const rand = seeded(5);
    for (let i = 0; i < 1500; i++) {
      c.fillStyle = "#b8c4c90e";
      c.fillRect(rand() * 512, rand() * 512, rand() * 7, 1);
    }
  });
  map.wrapS = map.wrapT = T.RepeatWrapping;
  map.repeat.set(22, 30);
  return new T.MeshStandardMaterial({ map, metalness: 0.49, roughness: 0.56 });
}
export function room(isFlight: boolean, seed: number) {
  const b = new Fabricator(),
    root = new T.Group(),
    flight = isFlight;
  const metal = alloy("#414e57"),
    dark = alloy("#202c34"),
    edge = alloy("#73848c"),
    black = alloy("#192127"),
    orange = alloy("#ca7335"),
    cyan = luminous("#97e9f1", 2),
    white = luminous("#d0f3f8", 2.9),
    warm = luminous("#ff964c", 2);
  const back = flight ? -45 : -10,
    half = flight ? 13 : 13,
    height = flight ? 15 : 8;
  b.part(new T.PlaneGeometry(100, 145), floor(), [0, -0.05, -10], [-Math.PI / 2, 0, 0]);
  b.box([0, height / 2, back], [half * 2 + 0.2, height, 0.24], dark);
  const rng = seeded(seed);
  for (let i = -3; i <= 3; i++) {
    const x = i * 3.7;
    b.box([x, 2.5, back + 0.17], [3.5, 4.9, 0.22], metal);
    b.box([x, 4.4, back + 0.31], [3.13, 0.18, 0.09], black);
    b.box([x, 5.4, back + 0.24], [3.36, 1.3, 0.11], edge);
    for (let k = 0; k < 9; k++)
      b.box([x - 1.48 + k * 0.37, 5.4, back + 0.35], [0.12, 1.25, 0.09], dark, [0, 0, -0.25]);
    b.box([x + 1.7, 2.4, back + 0.5], [0.18, 4.7, 0.3], edge);
    b.box([x + 1.69, 2.9, back + 0.69], [0.082, 2.95, 0.045], i % 3 ? white : warm);
    for (let j = 0; j < 6; j++) b.box([x, 1 + j * 0.47, back + 0.3], [2.9, 0.024, 0.06], black);
  }
  const sign = decal(flight ? "RANGE  /  02" : "BAY    04", "#27343b", "#adbdc1");
  b.part(new T.PlaneGeometry(3.04, 0.82), sign, [3.7, 2.77, back + 0.57]);
  // Service mezzanine, inset chambers and cable trays give the hall a second depth plane.
  const windowGlass = new T.MeshStandardMaterial({
    color: "#102f3d",
    metalness: 0.75,
    roughness: 0.22,
    emissive: "#104457",
    emissiveIntensity: 0.53,
  });
  const grille = surface(256, 128, (c) => {
    c.fillStyle = "#172126";
    c.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 15; i++) {
      c.fillStyle = "#516169";
      c.fillRect(5, 3 + i * 8, 246, 2);
      c.fillStyle = "#080e12";
      c.fillRect(5, 6 + i * 8, 246, 3);
    }
    for (const x of [15, 124, 240]) {
      c.fillStyle = "#334149";
      c.fillRect(x, 0, 4, 128);
    }
  });
  const grilleFinish = new T.MeshStandardMaterial({ map: grille, metalness: 0.45, roughness: 0.5 });
  const glowMap = surface(128, 64, (c) => {
    const g = c.createRadialGradient(64, 32, 0, 64, 32, 31);
    g.addColorStop(0, "rgba(126,237,255,.48)");
    g.addColorStop(0.25, "rgba(53,185,227,.24)");
    g.addColorStop(1, "rgba(0,100,150,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 64);
  });
  const wash = new T.MeshBasicMaterial({
    map: glowMap,
    transparent: true,
    depthWrite: false,
    blending: T.AdditiveBlending,
  });
  for (let i = -3; i <= 3; i++) {
    const x = i * 3.7;
    b.box([x, 3.94, back + 0.48], [3.47, 0.12, 0.8], black);
    if (i !== 1) {
      b.box([x, 2.52, back + 0.41], [3.08, 1.1, 0.14], black);
      b.part(new T.PlaneGeometry(2.89, 0.86), windowGlass, [x, 2.53, back + 0.49]);
      for (let k = 0; k < 4; k++)
        b.box([x - 1.3 + k * 0.86, 2.54, back + 0.54], [0.048, 0.96, 0.17], edge);
      b.box([x, 3.13, back + 0.52], [2.93, 0.052, 0.14], cyan);
      b.part(new T.PlaneGeometry(5.2, 1.8), wash, [x, 3.13, back + 0.61]);
      b.part(new T.PlaneGeometry(2.27, 0.64), grilleFinish, [x, 1.24, back + 0.34]);
    }
    b.box([x - 0.98, 0.63, back + 0.38], [0.66, 0.76, 0.23], dark);
    for (let k = 0; k < 4; k++)
      b.box([x - 1.19 + k * 0.12, 0.69, back + 0.51], [0.057, 0.08, 0.03], k === 2 ? warm : edge);
    b.rod([x + 0.7, 0.09, back + 0.6], [x + 1.1, 0.84, back + 0.6], 0.054, edge);
  }
  for (const sx of [-1, 1]) {
    b.box([sx * half, height / 2, -7], [0.3, height, 80], metal);
    for (let z = back; z < 25; z += 4.2) {
      b.box([sx * (half - 0.45), 3, z], [0.72, 6, 0.42], dark);
      b.rod([sx * (half - 0.5), 5.6, z], [sx * (half - 3.3), height, z], 0.23, edge, 4);
      b.box([sx * (half - 0.71), 2.5, z + 0.35], [0.07, 2.8, 0.12], cyan);
      b.box([sx * (half - 0.68), 1.15, z + 0.35], [0.12, 0.25, 0.2], orange);
      b.box([sx * (half - 1.5), 4.2, z], [2.7, 0.18, 4.2], black);
      b.rod([sx * (half - 2.8), 4.35, z], [sx * (half - 2.8), 5.05, z], 0.04, orange);
      b.rod([sx * (half - 2.8), 5, z], [sx * (half - 2.8), 5, z + 4.2], 0.035, orange);
      b.box([sx * (half - 0.21), 2.7, z + 2], [0.19, 1.35, 2.95], black);
      b.part(
        new T.PlaneGeometry(2.74, 1.08),
        grilleFinish,
        [sx * (half - 0.32), 2.72, z + 2],
        [0, (-sx * Math.PI) / 2, 0],
      );
      b.box([sx * (half - 0.35), 3.72, z + 1.95], [0.14, 0.07, 2.95], cyan);
      b.part(
        new T.PlaneGeometry(5.6, 2.2),
        wash,
        [sx * (half - 0.44), 3.68, z + 1.95],
        [0, (-sx * Math.PI) / 2, 0],
      );
      b.rod([sx * (half - 0.48), 4.4, z + 0.2], [sx * (half - 0.48), 6.8, z + 3.7], 0.13, edge, 4);
      if (rng() > 0.22) {
        const cx = sx * (half - 1.8);
        b.box([cx, 0.57, z + 1.1], [1.15, 1.15, 1.55], dark);
        for (const off of [-0.56, 0.56])
          b.box([cx, 0.59, z + 1.1 + off], [1.19, 1.19, 0.075], edge);
        b.part(
          new T.PlaneGeometry(1, 0.55),
          grilleFinish,
          [cx - sx * 0.59, 0.66, z + 1.1],
          [0, (-sx * Math.PI) / 2, 0],
        );
        b.box([cx - sx * 0.606, 0.23, z + 1.32], [0.022, 0.075, 0.25], orange);
      }
    }
    for (let j = 0; j < 3; j++)
      b.rod(
        [sx * (half - 0.48), 0.42 + j * 0.25, back],
        [sx * (half - 0.48), 0.42 + j * 0.25, 22],
        0.1,
        titaniumColor(j),
      );
    function titaniumColor(j: number) {
      return j === 0 ? orange : edge;
    }
    b.box([sx * (half - 2.4), 0.002, -7], [0.12, 0.018, 67], orange);
  }
  for (let z = back; z <= 24; z += 5) {
    if (flight || Math.abs(z) > 7) b.box([0, height, z], [half * 2, 0.4, 0.38], black);
    else for (const side of [-1, 1]) b.box([side * (half - 2), height, z], [4, 0.4, 0.38], black);
    for (const x of [-7, -3, 3, 7])
      if (flight || Math.abs(x) > 6 || Math.abs(z) > 8)
        b.box([x, height - 0.23, z], [2.7, 0.08, 0.22], white);
  }
  if (!flight) {
    b.cylinder([0, 0.11, 0], 3.7, 3.86, 0.28, black, 96);
    b.cylinder([0, 0.28, 0], 3.76, 3.79, 0.11, edge, 96);
    b.cylinder([0, 0.41, 0], 3.7, 3.7, 0.18, metal, 96);
    b.part(new T.CircleGeometry(3.69, 128), padMaterial(), [0, 0.506, 0], [-Math.PI / 2, 0, 0]);
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      b.arc([0, 0.34, 0], 3.765, 0.032, i % 3 ? cyan : warm, a, 0.42, 15);
      b.arc([0, 0.517, 0], 3.54, 0.018, i % 3 ? cyan : warm, a + 0.07, 0.29, 12);
    }
    for (const x of [-6.2, -4.4, 7.5])
      for (let j = 0; j < (x < -5 ? 2 : 1); j++) {
        const z = -6.0 + x * 0.08;
        b.box([x, 0.6 + j * 1.22, z], [1.6, 1.2, 1.45], dark);
        for (const off of [-0.62, 0.62])
          b.box([x + off, 0.6 + j * 1.22, z], [0.12, 1.24, 1.49], edge);
        b.box([x, 0.72 + j * 1.22, z + 0.74], [0.45, 0.17, 0.02], orange);
      }
    // A wheeled ground-power unit feeds the pad through a slack service cable.
    const cart = new Fabricator(),
      casings = alloy("#526168", 0.5, 0.43);
    cart.box([0, 0.57, 0], [1.46, 0.74, 0.84], casings);
    cart.box([0, 0.985, 0], [1.52, 0.095, 0.89], dark);
    for (const xx of [-0.56, 0.56])
      for (const zz of [-0.35, 0.35]) {
        cart.part(
          new T.CylinderGeometry(0.205, 0.205, 0.12, 16),
          black,
          [xx, 0.18, zz],
          [Math.PI / 2, 0, 0],
        );
        cart.part(
          new T.CylinderGeometry(0.093, 0.093, 0.14, 12),
          edge,
          [xx, 0.18, zz],
          [Math.PI / 2, 0, 0],
        );
      }
    cart.part(new T.PlaneGeometry(0.73, 0.46), grilleFinish, [-0.23, 0.58, 0.431]);
    cart.box([0.45, 0.56, 0.438], [0.27, 0.42, 0.035], dark);
    for (let j = 0; j < 3; j++)
      cart.box([0.46, 0.65 - j * 0.08, 0.462], [0.18, 0.032, 0.016], j === 0 ? cyan : edge);
    for (const x of [-0.68, 0.68]) cart.box([x, 0.56, 0.45], [0.048, 0.62, 0.035], orange);
    cart.rod([0, 0.96, -0.18], [0, 1.47, -0.18], 0.064, edge);
    const display = surface(512, 256, (c) => {
      c.fillStyle = "#10252d";
      c.fillRect(0, 0, 512, 256);
      c.strokeStyle = "#365664";
      c.lineWidth = 2;
      for (let i = 20; i < 512; i += 24) {
        c.beginPath();
        c.moveTo(i, 30);
        c.lineTo(i, 236);
        c.stroke();
      }
      for (let i = 36; i < 240; i += 24) {
        c.beginPath();
        c.moveTo(12, i);
        c.lineTo(500, i);
        c.stroke();
      }
      c.strokeStyle = "#88cad3";
      c.lineWidth = 4;
      for (const x of [125, 233])
        for (const y of [79, 170]) {
          c.beginPath();
          c.arc(x, y, 28, 0, Math.PI * 2);
          c.stroke();
          c.beginPath();
          c.moveTo(x, y);
          c.lineTo(180, 122);
          c.stroke();
        }
      c.fillStyle = "#bddbdc";
      c.font = "18px monospace";
      c.fillText("GROUND POWER", 310, 60);
      for (let i = 0; i < 4; i++) c.fillRect(310, 86 + i * 24, 80 + i * 9, 4);
    });
    cart.box([0, 1.62, -0.19], [1.05, 0.56, 0.075], black, [-0.16, 0, 0]);
    cart.part(
      new T.PlaneGeometry(0.96, 0.47),
      new T.MeshStandardMaterial({
        map: display,
        emissive: "#5b97a7",
        emissiveMap: display,
        emissiveIntensity: 0.6,
      }),
      [0, 1.625, -0.14],
      [-0.16, 0, 0],
    );
    const unit = cart.finish();
    unit.position.set(-4.7, 0, 1.42);
    unit.rotation.y = 0.49;
    root.add(unit);
    const cablePath = new T.CatmullRomCurve3(
      [
        [-4.53, 0.37, 1.18],
        [-4.27, 0.08, 1.0],
        [-4.37, 0.029, 0.6],
        [-4.3, 0.03, 0.06],
        [-3.87, 0.038, -0.4],
        [-3.59, 0.18, -0.54],
      ].map((v) => new T.Vector3(...v)),
    );
    b.part(new T.TubeGeometry(cablePath, 42, 0.036, 7, false), black);
    for (const sx of [-1, 1])
      for (let i = 0; i < 13; i++) {
        b.box(
          [sx * 4.55, 0.006, -4.85 + i * 0.42],
          [0.32, 0.014, 0.12],
          i % 4 === 0 ? orange : edge,
          [0, sx * 0.48, 0],
        );
      }
    const shadow = surface(256, 256, (c) => {
      const grad = c.createRadialGradient(128, 128, 5, 128, 128, 127);
      grad.addColorStop(0, "rgba(0,5,8,.80)");
      grad.addColorStop(0.42, "rgba(0,6,8,.52)");
      grad.addColorStop(1, "rgba(0,5,8,0)");
      c.fillStyle = grad;
      c.fillRect(0, 0, 256, 256);
    });
    const shadowMesh = new T.Mesh(
      new T.PlaneGeometry(6.7, 5.5),
      new T.MeshBasicMaterial({ map: shadow, transparent: true, depthWrite: false }),
    );
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = 0.515;
    root.add(shadowMesh);
  } else {
    const pylons = decal("CAUTION", "#bc692f", "#111a20");
    for (const o of OBSTACLES) {
      b.cylinder([o.x, o.height / 2, o.z], o.radius * 0.9, o.radius, o.height, metal, 8);
      b.cylinder([o.x, o.height - 0.38, o.z], o.radius * 0.94, o.radius * 0.95, 0.42, orange, 8);
      b.cylinder([o.x, o.height + 0.02, o.z], o.radius * 0.79, o.radius * 0.8, 0.06, dark, 8);
      for (let j = 0; j < 8; j++) {
        const angle = (j * Math.PI) / 4;
        b.box(
          [
            o.x + Math.sin(angle) * o.radius * 0.87,
            o.height * 0.49,
            o.z + Math.cos(angle) * o.radius * 0.87,
          ],
          [0.18, o.height * 0.77, 0.17],
          black,
          [0, angle, 0],
        );
      }
      for (const h of [0.14, 0.25, 0.71, 0.78])
        b.cylinder(
          [o.x, o.height * h, o.z],
          o.radius * (1 - h * 0.1) + 0.02,
          o.radius * (1 - h * 0.1) + 0.02,
          0.105,
          h === 0.78 ? cyan : dark,
          8,
        );
      b.part(new T.PlaneGeometry(1.15, 0.25), pylons, [o.x, o.height - 1, o.z + o.radius * 0.92]);
    }
    const points = [{ x: 0, y: 3, z: 20 }, ...GATES];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1],
        v = points[i];
      for (let j = 0; j < 10; j++) {
        const t = j / 10;
        b.box([a.x + (v.x - a.x) * t, 0.018, a.z + (v.z - a.z) * t], [0.1, 0.03, 0.42], cyan, [
          0,
          Math.atan2(v.x - a.x, v.z - a.z),
          0,
        ]);
      }
    }
  }
  root.add(b.finish());
  const positions = new Float32Array(70 * 3);
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] = (rng() - 0.5) * 20;
    positions[i + 1] = rng() * 7;
    positions[i + 2] = (rng() - 0.5) * 22;
  }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.BufferAttribute(positions, 3));
  const dust = new T.Points(
    g,
    new T.PointsMaterial({
      color: "#abdadd",
      size: 0.016,
      transparent: true,
      opacity: 0.39,
      depthWrite: false,
    }),
  );
  root.add(dust);
  return { root, dust };
}
export function gateSet() {
  const group = new T.Group(),
    lights: T.MeshStandardMaterial[] = [];
  GATES.forEach((p, i) => {
    const b = new Fabricator(),
      rim = alloy("#354650"),
      light = luminous("#b6eef5"),
      tag = decal("0" + (i + 1), "#253239", "#e8eff0");
    lights.push(light);
    const r = GATE_RADIUS + 0.1;
    b.part(new T.TorusGeometry(r, 0.15, 8, 48), rim, [0, 0, 0]);
    b.part(new T.TorusGeometry(r - 0.08, 0.046, 6, 64), light, [0, 0, 0.14]);
    for (let j = 0; j < 8; j++) {
      const a = (j * Math.PI) / 4;
      b.box([Math.cos(a) * r, Math.sin(a) * r, 0.04], [0.39, 0.23, 0.42], rim, [0, 0, a]);
    }
    b.box([0, -(p.y + r) / 2, 0], [0.32, p.y - r, 0.42], rim);
    b.part(new T.PlaneGeometry(1.22, 0.53), tag, [0, r + 0.28, 0.19]);
    const frame = b.finish();
    frame.position.set(p.x, p.y, p.z);
    group.add(frame);
  });
  return { group, lights };
}
