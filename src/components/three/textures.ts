"use client";

import * as THREE from "three";
import { createRng, deriveSeed, type Rng } from "@/sim/rng";

/**
 * Procedural textures drawn on 2D canvases at runtime — no image files.
 * Cached per (name, seed) for the lifetime of the page: they are shared by
 * every scene mount instead of being regenerated and leaked on navigation.
 */
const cache = new Map<string, THREE.Texture>();

function make(
  key: string,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  opts: { repeat?: [number, number]; srgb?: boolean; anisotropy?: number } = {},
): THREE.CanvasTexture {
  const hit = cache.get(key);
  if (hit) return hit as THREE.CanvasTexture;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  if (opts.srgb !== false) tex.colorSpace = THREE.SRGBColorSpace;
  if (opts.repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(opts.repeat[0], opts.repeat[1]);
  }
  tex.anisotropy = opts.anisotropy ?? 8;
  tex.needsUpdate = true;
  cache.set(key, tex);
  return tex;
}

function grime(
  ctx: CanvasRenderingContext2D,
  rng: Rng,
  w: number,
  h: number,
  count: number,
  alpha: number,
) {
  for (let i = 0; i < count; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const r = 8 + rng() * 60;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const dark = rng() > 0.35;
    g.addColorStop(
      0,
      dark ? `rgba(0,0,0,${alpha * rng()})` : `rgba(160,180,190,${alpha * 0.35 * rng()})`,
    );
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

/** Hangar floor: 4×4 steel deck plates with seams, bolts and wear. */
export function hangarFloorTextures(seed: number): { map: THREE.Texture; rough: THREE.Texture } {
  const plates = 4;
  const map = make(
    `hangar-floor-${seed}`,
    1024,
    1024,
    (ctx, w, h) => {
      const rng = createRng(deriveSeed(seed, "floor"));
      ctx.fillStyle = "#1a1f25";
      ctx.fillRect(0, 0, w, h);
      const s = w / plates;
      for (let i = 0; i < plates; i++) {
        for (let j = 0; j < plates; j++) {
          const shade = 22 + Math.floor(rng() * 9);
          ctx.fillStyle = `rgb(${shade},${shade + 4},${shade + 9})`;
          ctx.fillRect(i * s + 3, j * s + 3, s - 6, s - 6);
          // Brushed streaks.
          ctx.globalAlpha = 0.05;
          for (let k = 0; k < 40; k++) {
            ctx.fillStyle = rng() > 0.5 ? "#9fb3c2" : "#000";
            ctx.fillRect(i * s + 3, j * s + 3 + rng() * (s - 6), s - 6, 1);
          }
          ctx.globalAlpha = 1;
          ctx.fillStyle = "#3a444e";
          for (const [bx, by] of [
            [12, 12],
            [s - 12, 12],
            [12, s - 12],
            [s - 12, s - 12],
          ]) {
            ctx.beginPath();
            ctx.arc(i * s + bx, j * s + by, 3.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      grime(ctx, rng, w, h, 70, 0.35);
      ctx.strokeStyle = "#07090b";
      ctx.lineWidth = 4;
      for (let i = 0; i <= plates; i++) {
        ctx.beginPath();
        ctx.moveTo(i * s, 0);
        ctx.lineTo(i * s, h);
        ctx.moveTo(0, i * s);
        ctx.lineTo(w, i * s);
        ctx.stroke();
      }
    },
    { repeat: [6, 6] },
  );
  const rough = make(
    `hangar-floor-rough-${seed}`,
    512,
    512,
    (ctx, w, h) => {
      const rng = createRng(deriveSeed(seed, "floor-rough"));
      ctx.fillStyle = "#8c8c8c";
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 90; i++) {
        const x = rng() * w;
        const y = rng() * h;
        const r = 10 + rng() * 50;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        const v = rng() > 0.5 ? 40 : 200;
        g.addColorStop(0, `rgba(${v},${v},${v},0.5)`);
        g.addColorStop(1, `rgba(${v},${v},${v},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
    },
    { repeat: [6, 6], srgb: false },
  );
  return { map, rough };
}

export function hazardTexture(): THREE.Texture {
  return make(
    "hazard",
    256,
    64,
    (ctx, w, h) => {
      ctx.fillStyle = "#121212";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#e89a12";
      for (let x = -h; x < w + h; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, h);
        ctx.lineTo(x + 16, h);
        ctx.lineTo(x + 16 + h, 0);
        ctx.lineTo(x + h, 0);
        ctx.closePath();
        ctx.fill();
      }
    },
    { repeat: [1, 1] },
  );
}

/** Landing-pad decal: rings, ticks, bearing marks and the facility code. */
export function padMarkingTexture(): THREE.Texture {
  return make("pad-marking", 1024, 1024, (ctx, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(143,241,255,0.9)";
    ctx.lineWidth = 3;
    for (const r of [470, 430, 250]) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const long = i % 6 === 0;
      ctx.lineWidth = long ? 4 : 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (long ? 380 : 405), cy + Math.sin(a) * (long ? 380 : 405));
      ctx.lineTo(cx + Math.cos(a) * 428, cy + Math.sin(a) * 428);
      ctx.stroke();
    }
    // Amber quadrant arcs.
    ctx.strokeStyle = "rgba(255,159,28,0.95)";
    ctx.lineWidth = 10;
    for (let q = 0; q < 4; q++) {
      ctx.beginPath();
      ctx.arc(cx, cy, 340, q * (Math.PI / 2) + 0.25, q * (Math.PI / 2) + Math.PI / 2 - 0.25);
      ctx.stroke();
    }
    // Centre crosshair.
    ctx.strokeStyle = "rgba(143,241,255,0.75)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 200, cy);
    ctx.lineTo(cx - 60, cy);
    ctx.moveTo(cx + 60, cy);
    ctx.lineTo(cx + 200, cy);
    ctx.moveTo(cx, cy - 200);
    ctx.lineTo(cx, cy - 60);
    ctx.moveTo(cx, cy + 60);
    ctx.lineTo(cx, cy + 200);
    ctx.stroke();
    ctx.fillStyle = "rgba(143,241,255,0.85)";
    ctx.font = "600 44px Bahnschrift, 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("AEGIS · PAD 01", cx, cy + 300);
    ctx.font = "500 26px Consolas, monospace";
    ctx.fillStyle = "rgba(255,159,28,0.9)";
    ctx.fillText("TEST ARTICLE ZONE — KEEP CLEAR", cx, cy - 300);
  });
}

export function gateNumberTexture(n: number): THREE.Texture {
  return make(`gate-number-${n}`, 256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#06090c";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 6;
    ctx.strokeRect(14, 14, w - 28, h - 28);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 170px Bahnschrift, 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(n), w / 2, h / 2 + 10);
    ctx.font = "500 22px Consolas, monospace";
    ctx.fillText("GATE", w / 2, 38);
  });
}

export function glowTexture(): THREE.Texture {
  return make("glow", 64, 64, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.25, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

export function carbonTexture(): THREE.Texture {
  return make(
    "carbon",
    128,
    128,
    (ctx, w, h) => {
      ctx.fillStyle = "#0e1013";
      ctx.fillRect(0, 0, w, h);
      const s = 16;
      for (let y = 0; y < h; y += s) {
        for (let x = 0; x < w; x += s) {
          const horizontal = (x / s + y / s) % 2 === 0;
          const g = horizontal
            ? ctx.createLinearGradient(x, y, x, y + s)
            : ctx.createLinearGradient(x, y, x + s, y);
          g.addColorStop(0, "#15181c");
          g.addColorStop(0.5, "#2a3038");
          g.addColorStop(1, "#15181c");
          ctx.fillStyle = g;
          ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
        }
      }
    },
    { repeat: [4, 1] },
  );
}

/** Flight arena deck: 1 m minor / 10 m major grid. */
export function arenaFloorTexture(): THREE.Texture {
  return make(
    "arena-floor",
    1024,
    1024,
    (ctx, w, h) => {
      ctx.fillStyle = "#0c1015";
      ctx.fillRect(0, 0, w, h);
      const rng = createRng(7);
      grime(ctx, rng, w, h, 40, 0.25);
      ctx.strokeStyle = "rgba(90,140,160,0.18)";
      ctx.lineWidth = 1;
      const minor = w / 10;
      for (let i = 0; i <= 10; i++) {
        ctx.beginPath();
        ctx.moveTo(i * minor, 0);
        ctx.lineTo(i * minor, h);
        ctx.moveTo(0, i * minor);
        ctx.lineTo(w, i * minor);
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(79,227,251,0.45)";
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, w - 4, h - 4);
    },
    { repeat: [9, 19] },
  );
}

/** Wall cladding: vertical panels, rivets, a lit band. */
export function wallPanelTexture(seed: number): THREE.Texture {
  return make(
    `wall-${seed}`,
    512,
    512,
    (ctx, w, h) => {
      const rng = createRng(deriveSeed(seed, "wall"));
      ctx.fillStyle = "#1c232b";
      ctx.fillRect(0, 0, w, h);
      const cols = 4;
      const cw = w / cols;
      for (let i = 0; i < cols; i++) {
        const v = 40 + Math.floor(rng() * 12);
        ctx.fillStyle = `rgb(${v},${v + 5},${v + 12})`;
        ctx.fillRect(i * cw + 3, 3, cw - 6, h * 0.62);
        ctx.fillRect(i * cw + 3, h * 0.66, cw - 6, h * 0.34 - 3);
        ctx.fillStyle = "#3b4651";
        for (let r = 0; r < 8; r++) {
          ctx.fillRect(i * cw + 8, 10 + r * (h / 8), 3, 3);
          ctx.fillRect(i * cw + cw - 11, 10 + r * (h / 8), 3, 3);
        }
      }
      grime(ctx, rng, w, h, 40, 0.3);
      ctx.fillStyle = "#e89a12";
      ctx.fillRect(0, h * 0.635, w, 6);
    },
    { repeat: [1, 1] },
  );
}

/** Monospace hologram label. */
export function holoLabelTexture(key: string, lines: string[], accent = "#8ff1ff"): THREE.Texture {
  return make(`holo-${key}`, 512, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 2;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.globalAlpha = 1;
    ctx.fillStyle = accent;
    ctx.font = "600 40px Bahnschrift, 'Segoe UI', sans-serif";
    ctx.fillText(lines[0] ?? "", 28, 64);
    ctx.font = "400 24px Consolas, monospace";
    lines.slice(1).forEach((l, i) => ctx.fillText(l, 28, 110 + i * 34));
  });
}
