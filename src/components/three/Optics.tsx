import { useLayoutEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  HalfFloatType,
  Vector2,
  WebGLRenderTarget,
  type WebGLRenderer,
  type Scene,
  type Camera,
} from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
function lens(gl: WebGLRenderer, scene: Scene, camera: Camera) {
  const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 2 });
  const composer = new EffectComposer(gl, target);
  const geometryPass = new RenderPass(scene, camera);
  const bloom = new UnrealBloomPass(new Vector2(1, 1), 0.075, 0.12, 1.65);
  const output = new OutputPass();
  composer.addPass(geometryPass);
  composer.addPass(bloom);
  composer.addPass(output);
  return {
    composer,
    dispose() {
      geometryPass.dispose();
      bloom.dispose();
      output.dispose();
      composer.dispose();
    },
  };
}
function countWholeFrames(gl: WebGLRenderer) {
  const original = gl.info.autoReset;
  gl.info.autoReset = false;
  return () => {
    gl.info.autoReset = original;
  };
}
/** Count the entire image including shadow draws, bloom mips and the final color transform. */
export function Optics({ high }: { high: boolean }) {
  const { gl, scene, camera, size } = useThree();
  const active = useRef<ReturnType<typeof lens> | null>(null);
  useLayoutEffect(() => countWholeFrames(gl), [gl]);
  useLayoutEffect(() => {
    if (!high) return;
    const pipeline = lens(gl, scene, camera);
    active.current = pipeline;
    return () => {
      active.current = null;
      pipeline.dispose();
    };
  }, [gl, scene, camera, high]);
  useLayoutEffect(() => {
    active.current?.composer.setPixelRatio(gl.getPixelRatio());
    active.current?.composer.setSize(size.width, size.height);
  }, [gl, size, high]);
  useFrame((_, dt) => {
    gl.info.reset();
    if (active.current) active.current.composer.render(dt);
    else gl.render(scene, camera);
  }, 1);
  return null;
}
