"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { ACESFilmicToneMapping, PCFShadowMap } from "three";
import type { Vec } from "@/features/flight/physics";

export type Quality = "LOW" | "MEDIUM" | "HIGH";
export type FrameStats = {
  frames: number;
  fpsMedian: number;
  fpsP05: number;
  frameP95: number;
  frameAverage: number;
  drawCalls: number;
  triangles: number;
  dpr: number;
};
const DPR: Record<Quality, number | [number, number]> = { LOW: 1, MEDIUM: [1, 1.25], HIGH: 1.5 };
export const SHADOW: Record<Quality, number> = { LOW: 0, MEDIUM: 1024, HIGH: 2048 };
const percentile = (a: number[], fraction: number) =>
  a[Math.max(0, Math.ceil(a.length * fraction) - 1)];

function Instrumentation({
  ready,
  report,
}: {
  ready: () => void;
  report?: (data: FrameStats) => void;
}) {
  const gl = useThree((s) => s.gl);
  const count = useRef(0);
  const samples = useRef<number[]>([]);
  const since = useRef(0);
  useFrame((_, dt) => {
    count.current++;
    if (count.current === 4) ready();
    if (!report || count.current < 5 || document.hidden) return;
    const ms = dt * 1000;
    if (ms <= 0) return;
    since.current += ms;
    samples.current.push(ms);
    if (samples.current.length > 600) samples.current.shift();
    if (since.current < 1000 || samples.current.length < 5) return;
    since.current = 0;
    const ordered = [...samples.current].sort((a, b) => a - b);
    const fps = ordered.map((n) => 1000 / n).reverse();
    report({
      frames: ordered.length,
      fpsMedian: percentile(fps, 0.5),
      fpsP05: percentile(fps, 0.05),
      frameAverage: ordered.reduce((a, b) => a + b, 0) / ordered.length,
      frameP95: percentile(ordered, 0.95),
      drawCalls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      dpr: gl.getPixelRatio(),
    });
  });
  return null;
}

class StageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="stage-loading" role="status">
        3D renderer unavailable. Verify WebGL 2 support and reload.
      </div>
    ) : (
      this.props.children
    );
  }
}

export function CanvasStage({
  quality,
  camera,
  frozen,
  performance,
  children,
}: {
  quality: Quality;
  camera: Vec;
  frozen: boolean;
  performance: boolean;
  children: ReactNode;
}) {
  const [ready, setReady] = useState(false);
  const [stats, setStats] = useState<FrameStats>();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // R3F's fallback and its render boundary own the error presentation.
    if (ready) ref.current?.setAttribute("data-scene-ready", "true");
  }, [ready]);
  return (
    <div
      className="canvas-stage"
      ref={ref}
      aria-label="Interactive 3D viewport"
      data-quality={quality}
    >
      <StageBoundary>
        <Canvas
          camera={{ position: camera, fov: 42, near: 0.1, far: 185 }}
          dpr={DPR[quality]}
          shadows={quality === "LOW" ? false : { type: PCFShadowMap }}
          frameloop="always"
          gl={{
            antialias: quality !== "LOW",
            toneMapping: ACESFilmicToneMapping,
            toneMappingExposure: 1.3,
            powerPreference: "high-performance",
          }}
          fallback={<div className="stage-loading">WebGL 2 is required for the 3D viewport.</div>}
        >
          {children}
          <Instrumentation
            ready={() => setReady(true)}
            report={performance && !frozen ? setStats : undefined}
          />
        </Canvas>
      </StageBoundary>
      {!ready && (
        <div className="stage-loading scene-loader" aria-live="polite">
          INITIALIZING 3D VIEWPORT
        </div>
      )}
      {performance && !frozen && (
        <aside
          className="perf"
          aria-label="Renderer performance"
          data-testid="perf"
          data-stats={stats ? JSON.stringify(stats) : undefined}
        >
          {stats ? (
            <>
              <strong>{stats.fpsMedian.toFixed(1)} FPS MED</strong>
              <span>
                {stats.fpsP05.toFixed(1)} FPS P05 · {stats.frameP95.toFixed(1)} ms P95
              </span>
              <span>
                {stats.frameAverage.toFixed(1)} ms AVG · {stats.frames} frames
              </span>
              <span>
                {stats.drawCalls} calls · {stats.triangles.toLocaleString("en-US")} tris
              </span>
              <span>
                {quality} · DPR {stats.dpr}
              </span>
            </>
          ) : (
            <span>Sampling frames · {quality}</span>
          )}
        </aside>
      )}
    </div>
  );
}
