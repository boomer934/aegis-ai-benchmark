"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { PAINTS, type PaintId } from "@/domain/config";
import { carbonTexture } from "../textures";

export interface DroneMaterials {
  hull: THREE.MeshPhysicalMaterial;
  hullUpper: THREE.MeshPhysicalMaterial;
  frame: THREE.MeshStandardMaterial;
  metal: THREE.MeshStandardMaterial;
  darkMetal: THREE.MeshStandardMaterial;
  rubber: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
  accent: THREE.MeshStandardMaterial;
  prop: THREE.MeshStandardMaterial;
  blur: THREE.MeshBasicMaterial;
  navRed: THREE.MeshStandardMaterial;
  navGreen: THREE.MeshStandardMaterial;
  strobe: THREE.MeshStandardMaterial;
  lens: THREE.MeshPhysicalMaterial;
}

function blurAlphaTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.18, "rgba(255,255,255,0.25)");
    g.addColorStop(0.8, "rgba(255,255,255,0.55)");
    g.addColorStop(0.93, "rgba(255,255,255,0.85)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  }
  return new THREE.CanvasTexture(c);
}

/**
 * Materials for one drone instance. Created once per mount and disposed on
 * unmount; paint / lighting changes mutate existing materials (no shader
 * recompilation, no re-render of the geometry tree).
 */
export function useDroneMaterials(paint: PaintId, lights: boolean): DroneMaterials {
  const mats = useMemo<DroneMaterials>(() => {
    const carbon = carbonTexture();
    const blurTex = blurAlphaTexture();
    return {
      hull: new THREE.MeshPhysicalMaterial({
        clearcoat: 0.7,
        clearcoatRoughness: 0.22,
        envMapIntensity: 1.2,
      }),
      hullUpper: new THREE.MeshPhysicalMaterial({
        clearcoat: 0.9,
        clearcoatRoughness: 0.12,
        envMapIntensity: 1.3,
      }),
      frame: new THREE.MeshStandardMaterial({ map: carbon, roughness: 0.42, metalness: 0.35 }),
      metal: new THREE.MeshStandardMaterial({ color: "#b9c3cc", metalness: 1, roughness: 0.26 }),
      darkMetal: new THREE.MeshStandardMaterial({
        color: "#2b3138",
        metalness: 0.85,
        roughness: 0.38,
      }),
      rubber: new THREE.MeshStandardMaterial({ color: "#0a0b0d", metalness: 0, roughness: 0.92 }),
      glass: new THREE.MeshPhysicalMaterial({
        metalness: 0.3,
        roughness: 0.04,
        clearcoat: 1,
        clearcoatRoughness: 0.03,
        envMapIntensity: 2,
        transparent: true,
        opacity: 0.93,
      }),
      accent: new THREE.MeshStandardMaterial({
        roughness: 0.35,
        metalness: 0.2,
        toneMapped: false,
      }),
      prop: new THREE.MeshStandardMaterial({ color: "#1b1f25", metalness: 0.25, roughness: 0.45 }),
      blur: new THREE.MeshBasicMaterial({
        color: "#a8b4bf",
        alphaMap: blurTex,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
      navRed: new THREE.MeshStandardMaterial({ color: "#300", toneMapped: false }),
      navGreen: new THREE.MeshStandardMaterial({ color: "#030", toneMapped: false }),
      strobe: new THREE.MeshStandardMaterial({ color: "#222", toneMapped: false }),
      lens: new THREE.MeshPhysicalMaterial({
        color: "#05080b",
        metalness: 0.9,
        roughness: 0.05,
        clearcoat: 1,
        iridescence: 0.6,
        envMapIntensity: 2,
      }),
    };
  }, []);

  useEffect(() => {
    const p = PAINTS[paint];
    mats.hull.color.set(p.hull);
    mats.hull.metalness = p.hullMetalness;
    mats.hull.roughness = p.hullRoughness;
    mats.hullUpper.color.set(p.hull).offsetHSL(0, 0, paint === "arctic" ? -0.04 : 0.05);
    mats.hullUpper.metalness = p.hullMetalness;
    mats.hullUpper.roughness = Math.max(0.12, p.hullRoughness - 0.12);
    mats.frame.color.set(p.frame).offsetHSL(0, 0, 0.35);
    mats.glass.color.set(p.glass);
    mats.glass.emissive.set(p.accent);
    mats.glass.emissiveIntensity = lights ? 0.06 : 0;
    mats.accent.color.set(lights ? p.accent : new THREE.Color(p.accent).multiplyScalar(0.18));
    mats.accent.emissive.set(p.accent);
    mats.accent.emissiveIntensity = lights ? 2.4 : 0;
    mats.navRed.color.set(lights ? "#ff2a3a" : "#3a0a0e");
    mats.navRed.emissive.set("#ff1a2a");
    mats.navRed.emissiveIntensity = lights ? 3 : 0;
    mats.navGreen.color.set(lights ? "#2bff7a" : "#0a3a1a");
    mats.navGreen.emissive.set("#1aff6a");
    mats.navGreen.emissiveIntensity = lights ? 3 : 0;
    mats.strobe.emissive.set("#ffffff");
    mats.strobe.emissiveIntensity = 0;
    mats.strobe.color.set(lights ? "#f4f8ff" : "#2a2c30");
  }, [mats, paint, lights]);

  useEffect(
    () => () => {
      for (const m of Object.values(mats)) {
        (m as THREE.Material & { alphaMap?: THREE.Texture | null }).alphaMap?.dispose();
        (m as THREE.Material).dispose();
      }
    },
    [mats],
  );

  return mats;
}
