"use client";

import { SceneCanvas } from "@/components/three/SceneCanvas";
import { useReducedMotion, useRuntime } from "@/components/ui/RuntimeContext";
import { useConfig } from "@/stores/configStore";
import { useHangar } from "./hangarStore";
import { CAMERA_PRESETS, HangarScene } from "./scene/HangarScene";

/** Client-only canvas host for the hangar (loaded with next/dynamic, ssr: false). */
export default function HangarCanvas() {
  const mode = useRuntime();
  const reducedMotion = useReducedMotion();
  const paint = useConfig((s) => s.paint);
  const engine = useConfig((s) => s.engine);
  const lights = useConfig((s) => s.lights);
  const quality = useConfig((s) => s.quality);
  const hydrated = useConfig((s) => s.hydrated);
  const preset = useHangar((s) => s.preset);
  const presetNonce = useHangar((s) => s.presetNonce);
  const inspecting = useHangar((s) => s.inspecting);

  if (!hydrated) return null;

  return (
    <SceneCanvas
      name="hangar"
      label="3D hangar view of the AX-7 Kestrel drone. Drag to orbit, scroll to zoom."
      quality={quality}
      camera={{ position: CAMERA_PRESETS[preset].position, fov: 38, far: 120 }}
    >
      <HangarScene
        paint={paint}
        engine={engine}
        lights={lights}
        quality={quality}
        preset={preset}
        presetNonce={presetNonce}
        inspecting={inspecting}
        frozen={mode.benchmark}
        seed={mode.seed}
        reducedMotion={reducedMotion}
      />
    </SceneCanvas>
  );
}
