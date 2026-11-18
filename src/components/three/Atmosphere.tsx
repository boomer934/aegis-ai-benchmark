"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { createRng, deriveSeed } from "@/sim/rng";
import { frameTime } from "./sceneTime";
import { glowTexture } from "./textures";

/**
 * Drifting dust motes. Positions are seeded; motion is computed entirely in
 * the vertex shader from a time uniform, so the CPU cost is one uniform write
 * per frame regardless of particle count.
 */
export function DustParticles({
  count,
  seed,
  frozen,
  box,
  color = "#9fdcef",
  size = 0.05,
}: {
  count: number;
  seed: number;
  frozen: boolean;
  box: { min: [number, number, number]; max: [number, number, number] };
  color?: string;
  size?: number;
}) {
  const { geometry, material } = useMemo(() => {
    const rng = createRng(deriveSeed(seed, "dust"));
    const pos = new Float32Array(count * 3);
    const phase = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = box.min[0] + rng() * (box.max[0] - box.min[0]);
      pos[i * 3 + 1] = box.min[1] + rng() * (box.max[1] - box.min[1]);
      pos[i * 3 + 2] = box.min[2] + rng() * (box.max[2] - box.min[2]);
      phase[i] = rng() * 100;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geometry.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uMap: { value: glowTexture() },
        uColor: { value: new THREE.Color(color) },
        uSize: { value: size },
        uHeight: { value: box.max[1] - box.min[1] },
        uBase: { value: box.min[1] },
      },
      vertexShader: /* glsl */ `
        attribute float aPhase;
        uniform float uTime; uniform float uSize; uniform float uHeight; uniform float uBase;
        varying float vAlpha;
        void main() {
          vec3 p = position;
          float t = uTime * 0.12 + aPhase;
          p.y = uBase + mod(p.y - uBase + uTime * 0.05 * (0.5 + fract(aPhase)), uHeight);
          p.x += sin(t * 1.3) * 0.35;
          p.z += cos(t * 0.9) * 0.35;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uSize * (300.0 / -mv.z);
          float edge = smoothstep(0.0, 0.15, (p.y - uBase) / uHeight) * (1.0 - smoothstep(0.8, 1.0, (p.y - uBase) / uHeight));
          vAlpha = edge * (0.35 + 0.65 * fract(aPhase * 7.13));
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap; uniform vec3 uColor; varying float vAlpha;
        void main() {
          float a = texture2D(uMap, gl_PointCoord).a * vAlpha * 0.55;
          if (a < 0.01) discard;
          gl_FragColor = vec4(uColor, a);
        }
      `,
    });
    return { geometry, material };
    // box is a static literal per scene; seed/count changes rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, seed, color, size]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame((state, delta) => {
    material.uniforms.uTime.value = frameTime(state.clock.elapsedTime, delta, frozen).t;
  });

  return <points geometry={geometry} material={material} frustumCulled={false} />;
}

/** Shared additive "light shaft" material: vertical fade, soft edges. */
export function useLightShaftMaterial(color: string, intensity = 0.16): THREE.ShaderMaterial {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: { uColor: { value: new THREE.Color(color) }, uIntensity: { value: intensity } },
        vertexShader: /* glsl */ `
          varying float vY; varying vec3 vN; varying vec3 vView;
          void main() {
            vY = uv.y;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vN = normalize(normalMatrix * normal);
            vView = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor; uniform float uIntensity; varying float vY; varying vec3 vN; varying vec3 vView;
          void main() {
            float rim = pow(abs(dot(vN, vView)), 1.6);
            float a = uIntensity * smoothstep(0.0, 1.0, vY) * rim;
            gl_FragColor = vec4(uColor, a);
          }
        `,
      }),
    [color, intensity],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  return mat;
}
