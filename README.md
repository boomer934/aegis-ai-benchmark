# AEGIS — Drone Test Facility (benchmark starter)

A reproducible 3D full-stack coding benchmark for evaluating AI coding agents.

> **This is only the starter repository.** It contains the toolchain, configuration and
> infrastructure smoke tests — nothing else. The AEGIS application itself (3D scenes, drone,
> flight, telemetry, data model) is generated independently by each evaluated agent, starting
> from the same baseline commit.

## Purpose

Several AI coding agents receive the same benchmark prompt and build the AEGIS application from
this exact starting point. Because every run starts from one commit with a frozen lockfile, the
differences between the resulting applications come from the agents, not from the environment.

What the starter deliberately does **not** contain: no 3D scene, drone model, physics, telemetry,
navigation, animations, simulation, business logic or Prisma models.

## Stack

| Area       | Technology                               | Version                  |
| ---------- | ---------------------------------------- | ------------------------ |
| Runtime    | Node.js (pinned in `.nvmrc`)             | 26.8.1                   |
| Packages   | npm (bundled with Node 26.8.1)           | 11.19.0                  |
| Framework  | Next.js (App Router, Turbopack)          | 16.4.6                   |
| UI         | React / React DOM                        | 19.3.1                   |
| Language   | TypeScript (`strict`)                    | 6.0.3                    |
| Styling    | Tailwind CSS (`@tailwindcss/postcss`)    | 4.3.5                    |
| 3D         | Three.js / React Three Fiber / Drei      | 0.187.0 / 9.8.2 / 10.7.9 |
| Data       | Prisma ORM + SQLite                      | 7.10.1                   |
| Validation | Zod                                      | 4.6.7                    |
| Unit tests | Vitest + jsdom + React Testing Library   | 5.1.0 / 31.0.1 / 16.3.3  |
| E2E tests  | Playwright (Chromium)                    | 1.65.1                   |
| Tooling    | ESLint (`eslint-config-next`) + Prettier | 9.39.5 / 3.10.1          |

All versions are pinned exactly in `package.json` and frozen in `package-lock.json`.

## Prerequisites

- **Node.js 26.8.1** (`nvm use` reads `.nvmrc`). npm 11.19.0 ships with it.
- **Git** 2.40 or newer.
- About 500 MB of disk for `node_modules` plus the Playwright Chromium download.
- No accounts, API keys or paid services are required.

## Installation

```bash
git clone https://github.com/boomer934/aegis-ai-benchmark.git
cd aegis-ai-benchmark
nvm use                      # Node 26.8.1
npm ci                       # exact install from package-lock.json
cp .env.example .env         # non-secret local variables
npm run db:generate          # generate the Prisma client into src/generated/prisma
npm run db:migrate           # create the local SQLite database (prisma/dev.db)
npx playwright install chromium   # browser for E2E tests (add --with-deps on Linux)
```

`npm ci` runs the install scripts of `prisma` and `@prisma/engines`; they are explicitly allowed
in the `allowScripts` field of `package.json` (npm 11 blocks unlisted install scripts).

## Development commands

| Command             | What it does                                                             |
| ------------------- | ------------------------------------------------------------------------ |
| `npm run dev`       | Start the Next.js dev server on http://localhost:3000                    |
| `npm run build`     | Production build                                                         |
| `npm run start`     | Serve the production build                                               |
| `npm run lint`      | ESLint (Next.js core-web-vitals + TypeScript rules, Prettier-compatible) |
| `npm run typecheck` | Generate Next.js route types, then `tsc --noEmit`                        |
| `npm run format`    | Format with Prettier (`format:check` to verify only)                     |

## Database setup

- Prisma 7 configuration lives in `prisma.config.ts`; the schema is `prisma/schema.prisma`.
- `DATABASE_URL` comes from `.env` (copied from `.env.example`). The default is
  `file:./prisma/dev.db`, resolved from the project root. If `.env` is missing, the same default
  is used.
- The schema contains only the generator and the SQLite datasource — **no models**. Each agent
  designs its own data model.
- The client is generated to `src/generated/prisma` (git-ignored). Import it from
  `@/generated/prisma/client` once models exist.
- Prisma 7 needs a driver adapter to run queries at runtime (for SQLite, e.g.
  `@prisma/adapter-better-sqlite3`). It is not preinstalled, so agents choose it themselves.

| Command               | What it does                                                          |
| --------------------- | --------------------------------------------------------------------- |
| `npm run db:generate` | `prisma generate`                                                     |
| `npm run db:migrate`  | `prisma migrate dev` — creates the SQLite file and applies migrations |

The SQLite files (`*.db`, journals) and `.env` are git-ignored.

## Testing

| Command            | What it does                                                          |
| ------------------ | --------------------------------------------------------------------- |
| `npm run test`     | Vitest unit and component tests (`src/**/*.test.ts(x)`, jsdom)        |
| `npm run test:e2e` | Playwright tests in `tests/e2e` on Chromium; starts `next dev` itself |
| `npm run test:all` | typecheck → lint → unit tests → E2E tests                             |

The current tests only prove the infrastructure works: one arithmetic unit test, one React
Testing Library render, one browser test that loads the starter page.

Playwright never reuses an already running server, so it cannot accidentally test another
worktree's app. When several environments run on one machine, give each its own port:

```bash
PLAYWRIGHT_PORT=3101 npm run test:e2e
```

## Continuous integration

`.github/workflows/ci.yml` runs on every push and pull request (ubuntu-24.04, no secrets):
checkout → Node from `.nvmrc` → `npm ci` → Prisma generate → lint → typecheck → unit tests →
build → `playwright install --with-deps chromium` → E2E tests. The Playwright report is uploaded
when a step fails.

## Benchmark execution protocol

The full protocol — creating three independent environments from the same baseline commit, what
to record for each run, and how to evaluate the results — is in
[`docs/BENCHMARK_PROTOCOL.md`](docs/BENCHMARK_PROTOCOL.md).

In short:

```bash
BASE=$(git rev-parse main)
for name in astra sol opus; do
  git branch "benchmark/$name" "$BASE"
  git worktree add "../aegis-$name" "benchmark/$name"
done
```

Every agent receives the same benchmark prompt, unmodified, in its own environment.

## Repository structure

```
aegis-ai-benchmark/
├── src/
│   ├── app/                 # Next.js App Router: layout.tsx, page.tsx, globals.css
│   ├── components/
│   │   ├── ui/              # (empty) UI components
│   │   └── three/           # (empty) React Three Fiber components
│   ├── features/
│   │   ├── hangar/          # (empty)
│   │   ├── flight/          # (empty)
│   │   └── telemetry/       # (empty)
│   ├── lib/                 # (empty) shared utilities
│   ├── hooks/               # (empty) React hooks
│   ├── stores/              # (empty) client state
│   ├── types/               # (empty) shared types
│   └── tests/               # Vitest setup + infrastructure smoke tests
├── prisma/
│   └── schema.prisma        # generator + SQLite datasource, no models
├── tests/
│   └── e2e/                 # Playwright smoke test
├── public/                  # static assets (empty)
├── artifacts/
│   └── screenshots/         # evaluation screenshots (empty)
├── docs/
│   └── BENCHMARK_PROTOCOL.md
├── .github/workflows/ci.yml
├── .env.example
├── .gitattributes           # LF line endings on every platform
├── .gitignore
├── .nvmrc
├── .prettierrc.json / .prettierignore
├── eslint.config.mjs
├── next.config.ts
├── postcss.config.mjs
├── prisma.config.ts
├── playwright.config.ts
├── vitest.config.ts
├── tsconfig.json
├── package.json / package-lock.json
├── LICENSE
└── README.md
```

Empty directories are kept with `.gitkeep` files.

## Known notes

- The repository contains no agent instruction files (`AGENTS.md`, `CLAUDE.md`, …). Next.js
  16.4 would write an `AGENTS.md` during `next dev` when it detects an AI agent; this is turned off
  with `agentRules: false` in `next.config.ts`, so every agent starts from the same files.
- `npm audit` reports a high-severity ReDoS advisory in `picomatch` (GHSA-fc5q-39xc-vjpf),
  pulled in only by development tooling (Vite/Vitest, typescript-eslint). No patched version
  exists in the dependency ranges; it does not reach the application bundle.
- The Prisma CLI may print an "update available" notice for a Prisma 8 release candidate. The
  benchmark stays on the stable 7.10.1.

## License

[MIT](LICENSE)
