# AEGIS — Drone Test Facility

An interactive 3D drone engineering and flight-test platform built with Next.js, React Three
Fiber and a deterministic TypeScript flight simulation.

- **01 Hangar** — a fully procedural quadrotor (AX-7 "Kestrel") on an illuminated pad inside an
  industrial hangar. Orbit/zoom, Hero/Side/Top camera presets, three liveries, three engine
  profiles (ECO / SPORT / RACE) that feed the flight model, drone lighting toggle and an
  inspection sequence (exploded view + scan sweep + subsystem checklist).
- **02 Flight Test** — pilot the drone through five numbered gates in order within 60 s.
  Fixed-step physics (inertia, drag, speed caps, boost, energy), collisions with the arena and
  obstacles, scoring with collision penalties, success/failure, pause/reset/replay, HUD,
  minimap and touch controls.
- **03 Mission Control** — live/last simulation state, interactive telemetry (speed, altitude,
  energy as small multiples with a synchronised crosshair), mission history and a leaderboard
  backed by Prisma + SQLite.

Everything 3D is generated in code (geometry, materials, canvas-drawn textures). No external
models, images, fonts, APIs or network resources are used at runtime.

## Requirements

- Node.js 26.8.1 (`.nvmrc`), npm 11.19.0
- No accounts, keys or paid services

## Install and run

```bash
nvm use
npm ci
cp .env.example .env          # optional; defaults to file:./prisma/dev.db
npm run db:setup              # prisma generate + apply migrations (creates prisma/dev.db)
npm run dev                   # http://localhost:3000
```

Production:

```bash
npm run build
npm run start
```

`npm run db:migrate` (prisma migrate dev) also works for local schema development.

## Controls (Flight Test)

| Input                     | Action                           |
| ------------------------- | -------------------------------- |
| W / A / S / D (or arrows) | Horizontal movement              |
| Q / E                     | Descend / ascend                 |
| Shift (hold)              | Boost (drains energy faster)     |
| Enter                     | Start mission (3 s countdown)    |
| Space                     | Pause / resume an active mission |
| R                         | Reset flight                     |

Touch devices get a virtual stick plus ascend / descend / boost buttons (toggle with
"Touch controls" on desktop). Gates only count when the drone physically crosses the gate
opening in the correct direction and in order.

## Scripts

| Command                           | What it does                                                                                                |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `npm run dev` / `build` / `start` | Next.js dev server, production build, production server                                                     |
| `npm run db:setup`                | Generate the Prisma client and apply migrations                                                             |
| `npm run typecheck` / `lint`      | TypeScript (strict) / ESLint                                                                                |
| `npm run test`                    | Vitest unit tests (simulation, scoring, validation)                                                         |
| `npm run test:e2e`                | Playwright (desktop 1440×900 + mobile 390×844); starts its own dev server with an isolated `prisma/e2e.db`  |
| `npm run bench:screenshots`       | Capture the 5 benchmark screenshots from a running server (default `http://localhost:3000`)                 |
| `npm run bench:perf`              | Measure live FPS / frame times / draw calls on a running server (writes `artifacts/perf/perf-results.json`) |

Use `PLAYWRIGHT_PORT=3101 npm run test:e2e` to pick a different port. Stop any `next dev`
running in the same folder first (Next 16 allows one dev server per project).

## Benchmark and measurement modes

- `?benchmark=1&seed=42` — fixed configuration (Graphite / SPORT / lights on / HIGH, DPR 1.5),
  seeded procedural details, animation time frozen, no debug panels, fixed camera framing.
  - `/?benchmark=1&seed=42&scene=hangar&camera=hero` (also `camera=top`, `camera=side`)
  - `/?benchmark=1&seed=42&scene=flight&camera=chase` — a real in-flight state produced by
    flying the simulation with the scripted autopilot until just after gate 1, then frozen.
    Pressing any flight key (or Start) hands control to the user.
  - `/?benchmark=1&seed=42&scene=telemetry` — clearly labelled deterministic demo data
    (every demo record is an actual autopilot run of the simulation).
- `?perf=1` — HIGH quality, DPR fixed to 1.5, performance panel visible. The panel can also be
  toggled with the **Perf** button in the header.
- When a scene has rendered real frames the document gets `html[data-scene-ready="<scene>"]`,
  which the screenshot script waits for.

## API

| Method | Route                                                                        | Notes                                                                                                           |
| ------ | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/missions?limit=1..100&outcome=success\|failed&engine=ECO\|SPORT\|RACE` | Newest first, `{ missions, total }`                                                                             |
| `POST` | `/api/missions`                                                              | JSON mission result; Zod-validated (400), plausibility-checked (422), 415 on wrong content type, 413 if > 64 KB |
| `GET`  | `/api/missions/:id`                                                          | Full record including telemetry trace and splits (404 if unknown)                                               |
| `GET`  | `/api/leaderboard?limit=1..50&engine=…`                                      | Successful missions by score, then time                                                                         |

Database failures return 503 with a readable message. Results are reported by the client, so
the server can only reject malformed or physically impossible records (see
`BENCHMARK_REPORT.md` → limitations).

## Project structure

```
src/
  sim/               deterministic simulation: physics, collisions, checkpoints, mission, scoring,
                     fixed-step stepper, seeded RNG, arena definition, test autopilot (+ unit tests)
  domain/            shared config (paints, quality profiles) and API types
  lib/validation/    Zod schemas + plausibility checks (+ unit tests)
  lib/server/        Prisma client (libSQL adapter), repository, HTTP helpers
  app/               routes: /hangar, /flight, /control, /api/*
  components/three/  procedural drone, textures, atmosphere, shared canvas + perf probe
  components/ui/     app shell, controls, perf panel, runtime context
  features/hangar    hangar scene + configuration UI
  features/flight    flight controller, input, arena scene, HUD
  features/telemetry mission control dashboard, charts, demo data
  stores/            tiny external stores (config, flight snapshot, perf)
tests/e2e/           Playwright specs
scripts/             screenshot capture and performance measurement
artifacts/           screenshots, perf results, command logs
```

## Further reading

- `BENCHMARK_REPORT.md` — what was built, decisions, test results, performance, limitations
- `BENCHMARK_METRICS.json` — machine-readable metrics
- `docs/BENCHMARK_PROTOCOL.md` — how the benchmark itself is run

## License

[MIT](LICENSE)
