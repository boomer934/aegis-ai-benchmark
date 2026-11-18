# AEGIS — Benchmark Report

Agent: Claude Code (model `claude-opus-5-5`), branch `benchmark/opus`, baseline
`8b14fb800825eb25bc77785184aecaf8022c5f82` (verified before any change: clean tree, HEAD equal
to `main`).

Machine used for every measurement below: Windows 11 Pro, NVIDIA GeForce RTX 5060
(Chromium ANGLE / Direct3D11), Node 26.8.1, npm 11.19.0.

## 1. Features implemented

### Module A — Hangar

- **Procedural drone (AX-7 "Kestrel")**, ~45 meshes from code only: extruded fuselage with
  bevels, upper deck, emissive waist ring, tinted canopy, dorsal spine, LiDAR puck, nose sensor
  "eyes", side vent slats, panel seams, battery module with cooling fins, instanced bolts
  (one draw call), four tapered carbon arms with lightening holes and hub joints, four rotor
  assemblies (motor base, aluminium bell, status ring, merged prop guard with struts, twisted
  three-blade propellers counter-rotating in diagonal pairs, motion-blur disc driven by rotor
  speed), tube-geometry landing skids with struts / braces / rubber feet, 3-axis camera gimbal
  (stabilised against airframe pitch in flight), antennas with strobes, red/green/white nav
  lights and an accent underglow light. 14 materials (clear-coated hull and deck, carbon,
  aluminium, dark metal, rubber, glass, iridescent lens, emissive accent, propeller composite,
  red / green / strobe nav lights, motion blur).
- **Hangar**: textured steel deck (canvas-drawn plates, seams, bolts, seeded wear + roughness
  map), panelled walls, instanced pillars / trusses / girders / cable trays, blast door with
  animated amber seam and signage, cyan wall light bands, nine ceiling lamps with light shafts,
  octagonal landing platform with hazard ring, decal markings, emissive inlays, edge marker
  lights, rotating holo-scanner arcs and an expanding scan pulse; a robot arm and gantry crane
  in slow motion, server racks with instanced LEDs, crates, gas cylinder bank, workstation with
  screens, floating holographic spec panel; seeded GPU-animated dust; procedural environment map
  (drei `Lightformer`s) for reflections; exponential fog; shadows.
- **Interactions** (all functional, all keyboard reachable, visible focus):
  orbit/zoom (OrbitControls, damped, clamped above the floor); Hero / Side / Top presets with
  eased transitions (instant under reduced motion) and viewport-aware framing (subject offset
  left of the panel on desktop, camera backs off on portrait screens); three liveries
  (Graphite Ion / Arctic Survey / Vanta Strike — materials are mutated, no shader rebuild);
  ECO / SPORT / RACE with stat bars that read the actual flight-model constants; lighting
  toggle; inspection start/stop (exploded view, sweeping scan plane, 9 s subsystem checklist).
- Configuration persists across module navigation (module-scope store) and reloads
  (localStorage, sanitised on read).

### Module B — Flight Test

- **Deterministic simulation** (`src/sim`, no Three.js dependency): 120 Hz fixed timestep with
  accumulator + render interpolation; thrust → acceleration, exact exponential drag, stronger
  braking drag on released axes, horizontal / vertical speed caps, diagonal normalisation,
  boost multiplier, energy drain with a limp mode at 0 %, smoothed bank / pitch.
- **Engine profiles** change max speed, thrust, drag, climb, boost, tilt and energy drain
  (unit- and browser-tested: RACE measurably faster than ECO, ECO more efficient).
- **Collisions**: sphere vs. oriented boxes and vertical cylinders plus arena bounds;
  penetration resolution, restitution, tangential friction; a collision is counted per new
  impact above an impact-speed threshold with a 0.5 s cooldown (gentle landings and sliding
  contact are not counted); camera shake + HUD flash.
- **Mission**: five numbered gates with solid frames (the frames are collision volumes), a
  flowing guide path, a beacon over the next gate, obstacles (pillars, masts, blocks, beams,
  walls), 3 s countdown, 60 s limit, swept-segment gate detection (direction-aware, in order
  only; out-of-order passes are reported and ignored), score = 1000/gate − 250/collision +
  50/s remaining on success, success / timeout failure, result dialog with splits, automatic
  persistence (with retry on failure), replay. Space pause, R reset, Enter start; on-screen
  equivalents for all of them; touch stick + hold buttons.
- **HUD**: status, time left, gate pips, score, hits, speed / altitude / energy gauges, boost
  state, tactical minimap drawn from the same arena data, collapsible control help.
- Leaving the arena or hiding the tab auto-pauses an active mission; returning resumes the
  same world.

### Module C — Mission Control

- Live strip from the real simulation snapshot (status, mission time, checkpoints, collisions,
  speed, altitude, energy, score).
- Telemetry as three small multiples (speed / altitude / energy), each with its own y-scale
  (no dual axes), gate split markers, synchronised pointer crosshair, keyboard inspection
  (←/→, Shift for ×10), screen-reader readout. Source switch between the live session and any
  persisted record. Palette validated with the dataviz validator against the dark surface.
- Drone configuration card + pilot callsign used for new records.
- Mission history (filter all / complete / failed, select a row to load its trace) and a
  leaderboard (filter by engine). Loading skeletons, empty states, error states with retry.
- Benchmark mode uses deterministic demo data, labelled "Demo data · deterministic sim"
  everywhere it appears; each demo record is a real autopilot run of the simulation.

### Backend

- Prisma 7 + SQLite via the `@prisma/adapter-libsql` driver adapter (prebuilt binaries, no
  native compilation on Windows). Model `MissionRecord`, migration `20261118094421_init`.
- Routes: `GET/POST /api/missions`, `GET /api/missions/:id`, `GET /api/leaderboard`.
- Zod schemas (strict objects, enums, ranges, callsign pattern, trace tuples) + cross-field
  plausibility checks shared with the client simulation: success ⇔ 5 checkpoints, failures end
  at exactly 60 s, score must equal the scoring function, duration must not beat the
  physically possible minimum for the engine, speeds within the engine envelope, splits / trace
  monotonic and within the duration. 400 / 413 / 415 / 422 / 404 / 503 responses with readable
  messages; DB errors are logged server-side and never leaked.

### Cross-cutting

- Graphics quality LOW / MEDIUM / HIGH (DPR cap, shadows + map size, antialias, particle count,
  light shafts, environment resolution). `?perf=1` and `?benchmark=1` force HIGH at DPR 1.5;
  nothing degrades quality automatically.
- Developer perf panel (FPS median / p5, frame time p50 / p95 / p99, draw calls, triangles,
  geometries / textures, DPR, renderer) from a 600-frame ring buffer of real rAF intervals and
  `WebGLRenderer.info`; exposed as `window.__AEGIS_PERF__` for automation.
- Deterministic benchmark mode (seeded RNG streams, frozen animation clock, fixed camera,
  readiness signal `html[data-scene-ready]`).
- Responsive layout: desktop overlays; on mobile the canvas keeps 54 dvh with the
  configuration panel below, bottom tab bar, compact HUD, touch controls. No horizontal overflow
  (tested at 390 px). Reduced-motion support (camera cuts, no bobbing, CSS animations off).
  Skip link, ARIA radiogroups / switches / pressed states, live regions for status changes.
- WebGL unavailable / renderer crash → readable fallback panel instead of a blank canvas.

## 2. Features incomplete / partial

- **No in-browser automated full-course completion.** Completing all five gates is proven by
  the unit tests (a scripted autopilot producing ordinary stick inputs completes the course on
  all three engines with zero collisions) and by the benchmark staging (the autopilot flies the
  live browser simulation through gate 1). The browser test flies through gate 1 and into an
  obstacle by keyboard, but does not fly the entire course.
- No audio.
- The drone has no yaw control (W/A/S/D move in world axes relative to the fixed chase camera,
  which matches the spec but means the drone always faces down-range).
- The flight scene creates a few dozen small per-gate `BoxGeometry`s instead of instancing them
  (188 live geometries in flight vs 91 in the hangar); harmless at current counts.

## 3. Architectural decisions

- **Simulation is pure TypeScript** (`src/sim`) and owns all gameplay truth; React Three Fiber
  only renders it. This made the physics, gates, collisions, scoring and validation unit-testable
  and lets the server reuse the exact scoring / envelope constants.
- **Fixed 120 Hz step + accumulator** for frame-rate independence (tested: identical
  trajectories at 30 / 60 / 120 fps) and determinism (tested: identical inputs → identical
  results).
- **No React re-renders at frame rate**: the render loop reads input from a module object,
  mutates Three objects directly, and publishes a HUD snapshot to a tiny external store at
  ~12 Hz (immediately on status events). Components subscribe with selectors via
  `useSyncExternalStore`.
- **Shared, cached resources**: drone geometry built once per page and shared by both scenes;
  canvas textures cached per seed; per-mount materials disposed on unmount; merged geometries
  for propellers, guards, struts, fins, vents, seams; instancing for bolts, LEDs, pillars,
  trusses, towers.
- **Arena data drives both physics and rendering**, so every visible solid is exactly its
  collision volume (gate frames included) and the minimap is drawn from the same data.
- **libSQL driver adapter** instead of better-sqlite3 to avoid native builds (npm 11 blocks
  unlisted install scripts, and Node 26 prebuilts were uncertain).
- **Lint**: the React Compiler rule `react-hooks/immutability` is disabled only for
  `src/components/three/**` and `src/features/*/scene/**`, because mutating Three.js objects in
  `useFrame` is R3F's intended pattern; all other compiler rules stay on and were fixed
  properly (e.g. `useSyncExternalStore` media queries, key-based form reset, request-keyed fetch
  state instead of setState-in-effect).

## 4. Commands executed and results (final state)

| Command                                                      | Result                                    | Log                                                           |
| ------------------------------------------------------------ | ----------------------------------------- | ------------------------------------------------------------- |
| `npm run typecheck`                                          | pass (0 errors)                           | `artifacts/logs/typecheck.log`                                |
| `npm run lint`                                               | pass (0 problems)                         | `artifacts/logs/lint.log`                                     |
| `npm run test`                                               | **46 / 46 passed** (5 files)              | `artifacts/logs/unit.log`                                     |
| `npm run build`                                              | pass (Next 16.4.6 Turbopack)              | `artifacts/logs/build.log`                                    |
| `PLAYWRIGHT_PORT=3113 npx playwright test`                   | **17 / 17 passed** (15 desktop, 2 mobile) | `artifacts/logs/e2e.log`                                      |
| `node scripts/capture-screenshots.mjs http://localhost:3103` | 5 screenshots, 0 page errors              | `artifacts/logs/screenshots.log`                              |
| `node scripts/measure-perf.mjs http://localhost:3103`        | see §6                                    | `artifacts/logs/perf.log`, `artifacts/perf/perf-results.json` |

Unit test coverage: flight movement / inertia / drag / caps / boost / climb / bank / limp mode;
engine profile differences; fixed-step frame-rate independence and spiral-of-death clamp;
checkpoint direction / bounds / ordering from simulated movement; collisions (no penetration,
penalty, cooldown, gentle landing, ignored outside missions); scoring; countdown, pause,
reset, timeout; autopilot completion on all engines; determinism; Zod + plausibility
validation (types, enums, ranges, callsigns, forged score, impossible duration / speed,
inconsistent outcome, non-monotonic splits / trace); query validation.

Browser test coverage: app loads and renders WebGL with no errors; navigation and active
states; hangar paint / engine / lights / camera / inspection; persistence across modules and
reload; keyboard access and focus ring; keyboard flight changes speed and altitude, speed decays
after release; pause freezes the timer, resume, reset; on-screen start / pause / reset (cannot
score gates); real gate 1 pass + obstacle hit with exact score; engine profile changes top
speed in the browser; API persistence (list, detail, leaderboard order); invalid input (bad
JSON, wrong content type, schema, forged score, impossible time, bad query, unknown / malformed
id); mission history UI with chart hover; mobile 390×844 hangar usability + no overflow; mobile
touch stick and ascend button drive the drone; benchmark routing / frozen staging / no debug
panel; perf mode real counters at DPR 1.5. Every page test fails on any uncaught page error or
console error (4xx responses from deliberate invalid-API calls excluded).

Problems found and fixed during the run: a GLSL reserved word (`active`) broke the guide-path
shader; a unit test window became too short after lowering the landing-gear rest height; a
stale `.next/cache/.tsbuildinfo` made `next build` report a type from a deleted declaration
(cleared cache; `npm run typecheck` was already clean).

## 5. Build and browser testing status

- Production build: passing. Routes: `/` (redirect honouring `?scene=`), `/hangar`, `/flight`,
  `/control`, three API routes.
- Browser tests: Chromium 1.65 headless; on Windows launched with
  `--use-angle=d3d11 --enable-gpu` (real GPU). On Linux CI the same tests run on SwiftShader;
  they are written to be time-tolerant but were **not executed on Linux in this run**.
- Screenshots: `artifacts/screenshots/01…05*.png`, captured from the running production build
  in benchmark mode after `data-scene-ready`.

## 6. Performance

Method (`scripts/measure-perf.mjs`): production build, Chromium headless with GPU, viewport
1440×900, `?perf=1` (HIGH, DPR 1.5, no adaptive quality). 3 s warm-up, ring buffer reset, then
600 consecutive real `requestAnimationFrame` intervals (~10 s). The flight scene is measured
while the drone is actually flying (mission running, W held). Draw calls / triangles are
`WebGLRenderer.info.render` of the last frame and include shadow-map passes.

| Scene          | FPS median | FPS p5 | Frame p50 | Frame p95 | Frame p99 | Draw calls | Triangles |
| -------------- | ---------- | ------ | --------- | --------- | --------- | ---------- | --------- |
| Hangar (vsync) | 59.2       | 55.6   | 16.9 ms   | 18.0 ms   | 18.1 ms   | 174        | 62,360    |
| Flight (vsync) | 59.2       | 55.6   | 16.9 ms   | 18.0 ms   | 18.1 ms   | 187        | 67,850    |

Observations and limitations:

- With vsync both scenes sit at the 60 Hz display cap with no long frames in the window; the
  numbers therefore show "no dropped frames on this GPU", not headroom.
- An "uncapped" run (`--disable-frame-rate-limit --disable-gpu-vsync`) is also recorded in
  `perf-results.json` (median ≈ 0.7–0.8 ms rAF interval). Treat it as an upper bound of loop
  throughput only: without vsync Chromium can issue frames faster than they are presented, and
  `performance.now()` resolution (~0.1 ms) limits precision. It is not used as the headline.
- The very first frames after mount include shader compilation (one-off hitch, ~1 s on first
  visit); measurements start after warm-up and exclude it by design.
- Results are for one high-end desktop GPU; integrated / mobile GPUs were not measured.

Optimisation decisions: shared geometry + texture caches; merged static geometry; instancing
for repeated props; particles animated entirely in the vertex shader (one uniform per frame);
one shadow-casting light per scene (the flight sun's shadow frustum follows the drone instead
of covering the 190 m arena); DPR caps per quality; emissive materials + a handful of point
lights instead of many real lights; environment map rendered once (`frames={1}`); render-loop
writes to refs, React only re-renders at ~12 Hz; WebGL resources disposed on unmount.

Bundle (production, `.next/static/chunks`): 18 JS files, 1,811,016 bytes raw /
525,758 bytes gzip in total. The largest chunk (934 KB raw / 247 KB gzip) is Three.js +
R3F + Drei and is loaded lazily via `next/dynamic` only when a 3D view mounts.

## 7. Known bugs / rough edges

- Holding a direction while the result dialog is open does nothing (by design inputs are locked
  after a mission) — the dialog must be closed with Replay / R.
- The hangar holo panel overlaps the background workstation screens in the Hero framing
  (cosmetic).
- Font rendering uses system fonts (Bahnschrift / Segoe UI / Cascadia Mono on Windows), so
  screenshots on other operating systems will differ slightly in typography.
- Next 16 permits one `next dev` per project folder; `npm run test:e2e` fails fast if a dev
  server is already running in the same worktree.

## 8. Limitations and trade-offs

- **Client-reported results are not trustworthy.** The server validates shape, ranges, the
  scoring formula and the physical envelope, but a user can still craft a plausible record
  (e.g. a slower legitimate-looking run). Real anti-cheat would need server-side replay of
  recorded inputs through the same deterministic simulation (the sim is deterministic, so this
  is a natural extension) or a server-authoritative simulation.
- No authentication or rate limiting (not required); callsigns are free text constrained by a
  pattern.
- Physics is a simplified arcade model (no rotor-level aerodynamics, no wind); the drone is a
  sphere for collisions.
- SQLite file database for local use only.

## 9. Usage / billing

Exact token counts and cost for this run are **not available** from the environment. The
Claude Code app reported plan-level usage only: about 43 % of the 5-hour window and 37 % of the
weekly allowance used at the time of writing (Pro plan, extra usage disabled), and a session
context of ~452k tokens. These are not billed-token or cost figures.
