"use client";

import { useMediaQuery } from "@/hooks/useMediaQuery";
import { SceneCanvas } from "@/components/three/SceneCanvas";
import { useReducedMotion, useRuntime } from "@/components/ui/RuntimeContext";
import { useConfig } from "@/stores/configStore";
import { useFlight } from "@/stores/flightStore";
import type { FlightController } from "./controller";
import { CHASE_OFFSET, FlightScene } from "./scene/FlightScene";

/** Client-only canvas host for the flight arena (loaded with next/dynamic). */
export default function FlightCanvas({ controller }: { controller: FlightController }) {
  const mode = useRuntime();
  const reducedMotion = useReducedMotion();
  const paint = useConfig((s) => s.paint);
  const lights = useConfig((s) => s.lights);
  const quality = useConfig((s) => s.quality);
  const hydrated = useConfig((s) => s.hydrated);
  const hasSession = useFlight((s) => s.hasSession);
  const portrait = useMediaQuery("(max-aspect-ratio: 1/1)");

  if (!hydrated) return null;
  const s = controller.world.arena.start;
  return (
    <SceneCanvas
      name="flight"
      label="3D flight arena with chase camera following the drone"
      quality={quality}
      ready={hasSession}
      camera={{ position: [s.x + CHASE_OFFSET.x, s.y + CHASE_OFFSET.y, s.z + CHASE_OFFSET.z], fov: 55, far: 420 }}
    >
      <FlightScene
        controller={controller}
        paint={paint}
        lights={lights}
        quality={quality}
        seed={mode.seed}
        reducedMotion={reducedMotion}
        portrait={portrait}
      />
    </SceneCanvas>
  );
}
