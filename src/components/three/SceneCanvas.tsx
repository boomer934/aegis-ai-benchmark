"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Component, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { QUALITY_PROFILES, type QualityId } from "@/domain/config";
import { MEASUREMENT_DPR } from "@/lib/runtime";
import { useRuntime } from "@/components/ui/RuntimeContext";
import { perfStats, recordFrame, resetPerf, summarizePerf } from "@/stores/perfStore";

declare global {
  interface Window {
    __AEGIS_PERF__?: { summarize: typeof summarizePerf; reset: typeof resetPerf };
  }
}

/** Records real frame intervals and renderer counters every frame. */
function PerfProbe({ scene, quality }: { scene: string; quality: QualityId }) {
  const gl = useThree((s) => s.gl);
  const last = useRef(0);
  useEffect(() => {
    resetPerf(scene);
    perfStats.quality = quality;
    perfStats.dpr = gl.getPixelRatio();
    try {
      const ctx = gl.getContext();
      const ext = ctx.getExtension("WEBGL_debug_renderer_info");
      perfStats.renderer = ext
        ? String(ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL))
        : String(ctx.getParameter(ctx.RENDERER));
    } catch {
      perfStats.renderer = "unavailable";
    }
    window.__AEGIS_PERF__ = { summarize: summarizePerf, reset: resetPerf };
  }, [gl, scene, quality]);
  useFrame(() => {
    const now = performance.now();
    if (last.current > 0) recordFrame(now - last.current);
    last.current = now;
    // info reflects the previous completed frame (autoReset clears it per render).
    const info = gl.info;
    perfStats.drawCalls = info.render.calls;
    perfStats.triangles = info.render.triangles;
    perfStats.geometries = info.memory.geometries;
    perfStats.textures = info.memory.textures;
    perfStats.programs = info.programs?.length ?? 0;
    perfStats.dpr = gl.getPixelRatio();
  });
  return null;
}

/** Marks the document once the scene has rendered several real frames. */
function SceneReadySignal({ name, ready }: { name: string; ready: boolean }) {
  const frames = useRef(0);
  const done = useRef(false);
  useFrame(() => {
    if (!ready || done.current) return;
    frames.current++;
    if (frames.current >= 12) {
      done.current = true;
      document.documentElement.dataset.sceneReady = name;
    }
  });
  useEffect(
    () => () => {
      if (document.documentElement.dataset.sceneReady === name)
        delete document.documentElement.dataset.sceneReady;
    },
    [name],
  );
  return null;
}

function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}

class SceneErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  componentDidCatch(err: unknown) {
    console.error("[aegis] 3D scene failed:", err);
  }
  render() {
    return this.state.error ? this.props.fallback : this.props.children;
  }
}

function SceneFallback({ reason }: { reason: string }) {
  return (
    <div role="alert" className="absolute inset-0 grid place-items-center p-6">
      <div className="panel max-w-md p-6 text-center">
        <div className="label !text-signal-red">3D view unavailable</div>
        <p className="mt-3 text-sm text-steel-300">{reason}</p>
      </div>
    </div>
  );
}

export function SceneLoader({ label }: { label: string }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 grid place-items-center"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-4">
        <div className="relative h-14 w-14">
          <div className="absolute inset-0 animate-spin rounded-full border border-ion-400/20 border-t-ion-400 [animation-duration:1.2s]" />
          <div className="absolute inset-3 animate-spin rounded-full border border-amber-500/20 border-b-amber-500 [animation-direction:reverse] [animation-duration:1.8s]" />
        </div>
        <div className="label">{label}</div>
      </div>
    </div>
  );
}

export interface SceneCanvasProps {
  name: string;
  quality: QualityId;
  camera: { position: [number, number, number]; fov: number; near?: number; far?: number };
  /** Additional readiness condition (e.g. staged state applied). */
  ready?: boolean;
  children: ReactNode;
  className?: string;
  label: string;
}

/**
 * Shared <Canvas> configuration: quality-driven DPR / shadows / antialiasing,
 * fixed DPR for measurements, perf probe, ready signal and WebGL fallbacks.
 * The canvas is keyed by quality because antialiasing is a context-creation flag.
 */
export function SceneCanvas({
  name,
  quality,
  camera,
  ready = true,
  children,
  className,
  label,
}: SceneCanvasProps) {
  const mode = useRuntime();
  const profile = QUALITY_PROFILES[quality];
  // Client-only component (loaded with ssr: false), so this runs in the browser.
  const [supported] = useState(webglAvailable);
  const [created, setCreated] = useState(false);

  const dpr: number | [number, number] =
    mode.benchmark || mode.perf ? MEASUREMENT_DPR : [1, profile.maxDpr];

  if (supported === false) {
    return (
      <SceneFallback reason="WebGL is not available in this browser. Enable hardware acceleration to view the 3D scene." />
    );
  }

  return (
    <div className={className ?? "absolute inset-0"} data-testid={`canvas-${name}`}>
      {supported && (
        <SceneErrorBoundary
          fallback={
            <SceneFallback reason="The 3D renderer failed to start. Reload the page to retry." />
          }
        >
          <Canvas
            key={quality}
            dpr={dpr}
            shadows={profile.shadows ? "percentage" : false}
            gl={{
              antialias: profile.antialias,
              powerPreference: "high-performance",
              preserveDrawingBuffer: false,
            }}
            camera={{
              position: camera.position,
              fov: camera.fov,
              near: camera.near ?? 0.1,
              far: camera.far ?? 400,
            }}
            onCreated={({ gl }) => {
              gl.toneMapping = THREE.ACESFilmicToneMapping;
              gl.toneMappingExposure = 1.05;
              setCreated(true);
            }}
            aria-label={label}
          >
            <Suspense fallback={null}>{children}</Suspense>
            <PerfProbe scene={name} quality={quality} />
            <SceneReadySignal name={name} ready={ready && created} />
          </Canvas>
        </SceneErrorBoundary>
      )}
      {!created && <SceneLoader label={`Initializing ${name}`} />}
    </div>
  );
}
