# AEGIS — Drone Test Facility

Inspect the Kestrel XR-07 in the engineering hangar, fly a timed five-gate course, and inspect the telemetry and rankings from your recorded runs. AEGIS runs locally with a procedural Three.js world and SQLite storage.

## Setup

Use the pinned Node 26.8.1 and npm 11.19.0 from the benchmark starter.

```powershell
npm ci
Copy-Item .env.example .env
npm run db:setup
npm run dev -- --port 3102
```

Open [the local facility](http://localhost:3102). On Unix shells, use `cp .env.example .env`. The default database is `prisma/dev.db`. `npm run db:setup` generates the Prisma client and applies the committed SQLite migration. Keep the default relative `DATABASE_URL` when calling scripts from the project root.

```powershell
npm run build
npm run start -- --port 3102
```

## Fly a trial

- In **Hangar**, drag or pinch to inspect the airframe. Pick a camera preset, finish, engine profile, and lighting state. Inspection orbit is available with motion enabled.
- In **Flight**, begin a trial to start the three-second countdown. Fly through the amber gate from the approach side, then follow the course map to the next one. The map and guidance show the relative position of the current gate.
- Use **W A S D** or the arrow keys to steer, **Q / E** to descend or climb, and hold **Shift** for boosted thrust. **Space** toggles pause with focus on the scene. **R** resets. You can hold the screen buttons and combine them using multitouch.
- A successful pass earns 250 points, an impact costs 75 points, and completion adds `floor(8 × seconds remaining)` points. Score bottoms out at zero. Completed courses enter the leaderboard, and all finished trials appear in history.
- In **Mission Control**, switch between the history and leaderboard, pick a run, then switch between speed, altitude and energy. Hover over the plot or adjust **Sample position** with the keyboard.

## Benchmark views

| View            | Query                                            |
| --------------- | ------------------------------------------------ |
| Hangar hero     | `?benchmark=1&seed=42&scene=hangar&camera=hero`  |
| Hangar top      | `?benchmark=1&seed=42&scene=hangar&camera=top`   |
| Flight chase    | `?benchmark=1&seed=42&scene=flight&camera=chase` |
| Mission Control | `?benchmark=1&seed=42&scene=telemetry`           |

Presentation URLs start from the stock configuration, with fixed scene time and camera. The chase view uses a fixed simulated maneuver. The Mission Control presentation uses a labeled demo archive. Choose a camera or navigate to return to interactive mode.

With `?perf=1`, the viewport runs live at HIGH with canvas DPR fixed to 1.5. For flight use `?perf=1&scene=flight`. The panel uses observed render-loop frame intervals and the renderer's preceding-frame draw counters. See [the benchmark report](BENCHMARK_REPORT.md) for sample conditions and limitations.

To recapture screenshots and observe runtime metrics, start a production server and run the following in a separate PowerShell terminal.

```powershell
npx playwright install chromium
$env:BENCHMARK_URL = "http://localhost:3102"
$env:AEGIS_CHROMIUM_GPU = "1"
npm run benchmark
```

The GPU flag asks Chromium to use hardware acceleration. Without it the script uses Chromium's normal headless path with software WebGL fallback enabled. Check the reported WebGL renderer before comparing performance across runs.

## Tests

```powershell
npm run lint
npm run typecheck
npm run test
npx playwright install chromium
$env:PLAYWRIGHT_PORT = "3102"
npm run test:e2e
```

Stop the running app on the test port before running Playwright. The runner provisions an isolated migrated SQLite database under `test-results/` and starts a fresh server. Set `PLAYWRIGHT_PRODUCTION=1` after running `npm run build` to test the production server.

## Persistence

`GET /api/missions` returns the latest 30 results and the 10 best completed runs. `POST /api/missions` accepts a bounded JSON envelope with run configuration, counters, score and telemetry. The run ID makes retries idempotent and conflicting submissions receive HTTP 409. The server verifies field ranges, consistency and score calculation. Rankings reflect unauthenticated, client-reported flights.

[Benchmark protocol](docs/BENCHMARK_PROTOCOL.md) · [Report](BENCHMARK_REPORT.md) · [Metrics](BENCHMARK_METRICS.json)
