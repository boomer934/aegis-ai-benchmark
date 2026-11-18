import { ENGINE_IDS, isEngineId, type EngineId } from "@/sim/profiles";

/** Paint configurations: material palettes applied to the procedural drone. */
export const PAINT_IDS = ["graphite", "arctic", "vanta"] as const;
export type PaintId = (typeof PAINT_IDS)[number];

export interface PaintScheme {
  id: PaintId;
  name: string;
  description: string;
  /** Primary shell panels. */
  hull: string;
  hullMetalness: number;
  hullRoughness: number;
  /** Secondary structure: arms, motor bells. */
  frame: string;
  /** Trim and accent (emissive strips, decals). */
  accent: string;
  /** Canopy / sensor glass tint. */
  glass: string;
}

export const PAINTS: Readonly<Record<PaintId, PaintScheme>> = {
  graphite: {
    id: "graphite",
    name: "Graphite Ion",
    description: "Gunmetal ceramic shell, cyan ion trim",
    hull: "#3a4048",
    hullMetalness: 0.75,
    hullRoughness: 0.32,
    frame: "#16191d",
    accent: "#2fe6ff",
    glass: "#0b2430",
  },
  arctic: {
    id: "arctic",
    name: "Arctic Survey",
    description: "Gloss white composite, signal orange trim",
    hull: "#d9dde2",
    hullMetalness: 0.2,
    hullRoughness: 0.28,
    frame: "#2a2e33",
    accent: "#ff7a1a",
    glass: "#1a1208",
  },
  vanta: {
    id: "vanta",
    name: "Vanta Strike",
    description: "Matte stealth black, amber hazard trim",
    hull: "#121316",
    hullMetalness: 0.35,
    hullRoughness: 0.7,
    frame: "#26221c",
    accent: "#ffb000",
    glass: "#2a1600",
  },
};

export const isPaintId = (v: unknown): v is PaintId =>
  typeof v === "string" && (PAINT_IDS as readonly string[]).includes(v);

/** Graphics quality profiles. */
export const QUALITY_IDS = ["LOW", "MEDIUM", "HIGH"] as const;
export type QualityId = (typeof QUALITY_IDS)[number];

export interface QualityProfile {
  id: QualityId;
  /** Device-pixel-ratio cap. */
  maxDpr: number;
  shadows: boolean;
  shadowMapSize: number;
  particles: number;
  antialias: boolean;
  /** Extra decorative lights / light shafts. */
  volumetrics: boolean;
  /** Reflective floor and environment-map resolution. */
  envResolution: number;
}

export const QUALITY_PROFILES: Readonly<Record<QualityId, QualityProfile>> = {
  LOW: {
    id: "LOW",
    maxDpr: 1,
    shadows: false,
    shadowMapSize: 512,
    particles: 120,
    antialias: false,
    volumetrics: false,
    envResolution: 64,
  },
  MEDIUM: {
    id: "MEDIUM",
    maxDpr: 1.25,
    shadows: true,
    shadowMapSize: 1024,
    particles: 380,
    antialias: true,
    volumetrics: true,
    envResolution: 128,
  },
  HIGH: {
    id: "HIGH",
    maxDpr: 2,
    shadows: true,
    shadowMapSize: 2048,
    particles: 800,
    antialias: true,
    volumetrics: true,
    envResolution: 256,
  },
};

export const isQualityId = (v: unknown): v is QualityId =>
  typeof v === "string" && (QUALITY_IDS as readonly string[]).includes(v);

export interface DroneConfig {
  paint: PaintId;
  engine: EngineId;
  lights: boolean;
}

export const DEFAULT_DRONE_CONFIG: Readonly<DroneConfig> = Object.freeze({
  paint: "graphite",
  engine: "SPORT",
  lights: true,
});

/** Parse an untrusted object (e.g. localStorage) into a valid config, field by field. */
export function sanitizeDroneConfig(raw: unknown): DroneConfig {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    paint: isPaintId(r.paint) ? r.paint : DEFAULT_DRONE_CONFIG.paint,
    engine: isEngineId(r.engine) ? r.engine : DEFAULT_DRONE_CONFIG.engine,
    lights: typeof r.lights === "boolean" ? r.lights : DEFAULT_DRONE_CONFIG.lights,
  };
}

export { ENGINE_IDS };
export type { EngineId };
