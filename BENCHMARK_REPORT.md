# AEGIS benchmark report

## Delivery

AEGIS runs locally from the verified `benchmark/astra` clone. The initial working tree was clean and HEAD matched the documented baseline `8b14fb800825eb25bc77785184aecaf8022c5f82`. The implementation, test databases and captures were produced in this worktree.

| Module          | Implemented behavior                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hangar          | Procedural Kestrel X4 with a lofted fuselage, removable panels, shrouds, swept three-blade propellers, exposed motor windings, landing skids and a camera gimbal. The bay includes a marked landing pad, overhead structures, service mezzanines, wall equipment and a wheeled ground-power unit. Inspect with drag, pinch, wheel, zoom buttons, three camera presets or an automatic orbit. Three paints, three motor profiles and navigation lights are functional. |
| Flight          | The chase camera follows the vehicle through a five-gate indoor circuit. WASD, Q/E, Shift and held touch controls drive the same simulation. A three-second countdown, sixty-second limit, ordered checkpoints, collision penalties, pause, reset, replay and terminal result states are implemented.                                                                                                                                                                 |
| Mission control | Measured velocity, altitude, energy and mission duration, an interactive three-channel trace, the current configuration and run totals. SQLite supplies recent results and ranked scores. Loading, empty, retry and save-failure states are handled.                                                                                                                                                                                                                  |
| Benchmark       | The four requested URL views use fixed initial settings, seeded details, a fixed idle animation phase and HIGH quality at DPR 1.5. The reference telemetry is explicitly labeled. Five screenshots come from the production server.                                                                                                                                                                                                                                   |

## Implementation decisions

The flight engine advances at 120 Hz using an accumulator. It integrates normalized input, acceleration, exponential drag, a profile-specific speed cap and boost. Swept segment/plane intersection determines whether the vehicle crossed the next gate inside its usable aperture. Wall, floor, ceiling and pylon contacts constrain movement. One continuous contact incurs one penalty. A success earns a time bonus. The app shares the score function with the API.

The facility store retains configuration between modules and captures the engine and paint at launch. Flight state is mutable inside the integrator. React instruments subscribe to published snapshots at roughly 10 Hz during a run. The 3D scene reads the latest pose every frame. The recorder samples approximately four times per simulated second and includes the final sample. The telemetry benchmark drives the ordinary integrator through three reference flights.

Next.js route handlers validate mission submissions with Zod and query Prisma through the libSQL adapter installed against a local SQLite file. The server checks bounds, score arithmetic, outcome consistency and a minimum travel time. A UUID identifies a sortie. Retrying an identical result is idempotent. Reusing an ID for a different result returns HTTP 409. Separate browser-storage keys preserve pending submissions across an outage and avoid overwriting another tab's queued flight. Confirmed writes remove their own pending key.

## Verification

| Executed command                               | Final result                                                                                                                |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                                       | Installed from the checked-in lockfile using Node 26.8.1 and npm 11.19.0.                                                   |
| `npm run db:migrate -- --name mission_archive` | Created and applied the checked-in migration during development.                                                            |
| `npm run db:setup`                             | Generated the Prisma client and verified the deployed migration. Browser tests also deploy it to a fresh SQLite database.   |
| `npm run test:all`                             | Passed. The constituent checks were also rerun after final lighting adjustments.                                            |
| `npm run typecheck` and `npm run lint`         | Passed as part of the full suite.                                                                                           |
| `npm run test`                                 | 32 passed, 0 failed. Includes the two infrastructure checks supplied with the starter.                                      |
| `npm run build`                                | Production compilation, TypeScript check and Next.js route generation succeeded.                                            |
| `npm run test:e2e`                             | 8 passed, 0 failed, 0 retries on the final production build.                                                                |
| `npm run capture`                              | Five PNGs written. Zero failed network requests, HTTP errors or uncaught browser exceptions during capture and sampling.    |
| `npm audit --omit=dev --json`                  | Zero production advisories reported. The full dependency-tree audit during installation reported 16 high-severity findings. |

Browser coverage includes a successful circuit flown by sending keyboard events to the running application, a real sixty-second timeout, an archive outage and recovery after a reload, idempotent retries, malformed requests, mobile touch input, pause/reset, retained customization and trace inspection. A capture regression compares the canvas before and after a fresh load, a paint change, zoom and orbit. The E2E database is separate from the default local mission archive.

Earlier verification caught an out-of-range checkpoint count that threw during validation, a Windows database URL that prevented the test server starting and a camera button whose accessible capitalization disagreed with its visible caption. Those cases were corrected. Visual inspection also exposed a ceiling beam between the top camera and the drone. The final inspection bay has a clear overhead aperture.

## Rendering and performance

Geometry for stationary parts is transformed once and merged by material. Rotors form separate reusable moving assemblies. Canvas textures generate markings, grilles and surface details. A procedurally lit room supplies environment reflections. HIGH adds a 1024-pixel shadow map and an HDR bloom pass. MEDIUM and LOW use direct rendering without these passes at DPR 1.15 and 1 respectively. Fixed particle counts, capped pixel ratios and explicit disposal bound GPU work.

On Windows with an NVIDIA GeForce RTX 5060 and headless Chromium 159.0.8154.6 using ANGLE/D3D11, the animated hero view measured **59.88 median FPS**, **59.52 fifth-percentile FPS** and **16.80 ms p95 frame time**. The median frame submitted 106 draw calls and 65,802 triangles across all passes. The page loaded nine JavaScript resources totaling 439,369 encoded bytes and 1,580,909 decoded bytes. The complete production static chunk directory contained ten JavaScript files totaling 1,693,503 bytes.

The capture script waits for fonts and an application readiness signal emitted after four render frames. It captures 1440 × 900 desktop views and a 390 × 844 mobile view. For performance it opens a separate animated hero view at `?perf=1`, waits for the first renderer sample and a further 2.5 seconds, then records 300 consecutive requestAnimationFrame intervals. FPS quantiles use the reciprocal of each interval. The panel reports one-second windows, and the capture records median displayed renderer counts. Three.js counters reset once before a complete visual frame so they include shadows and postprocessing. Resource Timing supplies the loaded JavaScript byte counts.

These timings include browser scheduling, vsync and compositor overhead. They characterize this machine and hangar view. They do not isolate GPU execution time or predict performance on a physical phone. Network and page-error totals cover the five screenshot navigations and the performance view. Deliberate failure injections in the test suite are outside that measurement.

## Completion and limitations

All requested modules, benchmark views and evidence files were delivered. No unresolved functional failure is known from the executed checks.

- The simulator uses an assisted point-mass model with a clearance margin and simplified obstacle volumes. Attitude is derived from velocity. Energy consumption is a profile-based estimate.
- SQLite stores mission summaries. The detailed trace is scoped to the current in-memory sortie. Reloading the page clears the active flight and restores pending result submissions.
- The leaderboard trusts client-reported results that pass validation. A determined client can construct a plausible fabricated result. This local benchmark has no authentication or authoritative replay service.
- The browser suite covers Chromium on Windows, including an emulated phone viewport with dispatched touch events. Physical mobile devices, Firefox and Safari were not measured.
- Billing and provider-level token accounting are unavailable. The metrics file identifies any harness-scoped usage counter separately.

See [the metrics](BENCHMARK_METRICS.json), [raw runtime evidence](artifacts/runtime.json), [screenshots](artifacts/screenshots/) and [startup instructions](README.md).
