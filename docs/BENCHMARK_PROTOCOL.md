# AEGIS Benchmark Protocol

This document describes how to run the AEGIS benchmark so that the results of different AI coding
agents can be compared fairly. The person running the benchmark (the **operator**) follows it;
the agents themselves only receive the benchmark prompt.

## 1. Principles

1. **One baseline.** Every run starts from the same commit of `main` (the baseline SHA).
2. **Frozen dependencies.** Installs use `npm ci`, which installs exactly what
   `package-lock.json` records. Agents may add dependencies during their run; the baseline does
   not change.
3. **Same prompt.** Every agent receives the same main benchmark prompt, byte for byte. No
   model-specific hints, extra context, rewording, examples or follow-up help that the other
   agents do not also get.
4. **Isolation.** Each agent works in its own directory on its own branch, and never sees the
   other agents' work.
5. **Same conditions.** Same machine (or identical hardware), same OS, same Node/npm versions,
   same time budget.

## 2. Record the baseline

```bash
cd aegis-ai-benchmark
git checkout main
git pull --ff-only
git status --short          # must print nothing
BASE=$(git rev-parse main)
echo "$BASE"                # write this SHA in every run record
```

## 3. Create three environments from the baseline

The suggested names are `aegis-astra`, `aegis-sol` and `aegis-opus`. Use either option below.

### Option A — Git worktrees (one shared repository)

```bash
BASE=$(git rev-parse main)
for name in astra sol opus; do
  git branch "benchmark/$name" "$BASE"
  git worktree add "../aegis-$name" "benchmark/$name"
done

# all three must print the same SHA as $BASE
for name in astra sol opus; do git rev-parse "benchmark/$name"; done
git worktree list
```

Worktrees share one `.git` object store, so an agent that runs `git log --all` or checks out
another branch could see the others' commits. Do not add a warning about this to the prompt
(that would change it). When strict isolation matters, use Option B, or run the agents one after
another and create each worktree only when its run starts.

### Option B — Independent clones (strict isolation)

```bash
BASE=<baseline SHA>
for name in astra sol opus; do
  git clone --no-local https://github.com/boomer934/aegis-ai-benchmark.git "aegis-$name"
  git -C "aegis-$name" switch -c "benchmark/$name" "$BASE"
done
```

Each clone has its own `.git`; nothing one agent commits is visible to the others.

### Prepare each environment

Run in each of the three directories:

```bash
nvm use                       # Node 26.8.1 from .nvmrc
npm ci
cp .env.example .env
npm run db:generate
npm run db:migrate            # creates prisma/dev.db
npx playwright install chromium
git status --short            # must print nothing before the agent starts
```

If the agents run at the same time on one machine, assign each its own port for the dev server and
the E2E tests (for example astra 3101, sol 3102, opus 3103):

```bash
npm run dev -- --port 3101
PLAYWRIGHT_PORT=3101 npm run test:e2e
```

Playwright is configured never to reuse a running server, so a port clash fails loudly instead of
testing the wrong application.

## 4. Run each agent

1. Open a fresh agent session whose working directory is that environment (e.g. `../aegis-sol`).
2. Record the start timestamp (UTC, ISO 8601).
3. Paste the main benchmark prompt, unmodified.
4. Let the agent work until it declares completion or the time budget runs out. Interventions
   (answering a question, approving a permission prompt) are allowed only if they are identical
   for every agent; log each one.
5. Record the finish timestamp.
6. Ask the agent (or do it yourself) to commit the final state on its `benchmark/<name>` branch.
   Do not merge benchmark branches into `main` or into each other.

## 5. What to record

Keep the run records **outside** the agents' working directories (for example in
`../aegis-results/`), so that no agent can read or change them. One record per run:

```yaml
run: aegis-sol                # environment name
branch: benchmark/sol
baseline_sha: <40-char SHA>   # git rev-parse main at preparation time
final_sha: <40-char SHA>      # git rev-parse HEAD after the run

model:
  identifier: <provider/model id as passed to the CLI or API>
  version: <dated version or snapshot, if the provider exposes one>
  reasoning_effort: <e.g. low | medium | high | n/a>
agent_cli:
  name: <CLI / harness name>
  version: <output of the CLI's --version>

environment:
  os: <name and version>
  cpu_ram: <e.g. 8-core, 32 GB>
  node: 26.8.1
  npm: 11.19.0

time:
  budget: <e.g. 120 min>
  start_utc: <ISO 8601>
  finish_utc: <ISO 8601>
  wall_clock_minutes: <number>

usage:
  input_tokens: <number or "n/a">
  output_tokens: <number or "n/a">
  cached_tokens: <number or "n/a">
  cost_usd: <actual billed cost or "n/a">
  source: <where the numbers come from: CLI summary, provider dashboard, ...>

interventions: []             # each operator message after the prompt, with timestamp

results:                      # run each command after the agent finishes, record pass/fail
  npm_ci: pass | fail
  db_generate: pass | fail
  db_migrate: pass | fail
  lint: pass | fail (n errors)
  typecheck: pass | fail (n errors)
  test: pass | fail (passed/total)
  build: pass | fail
  test_e2e: pass | fail (passed/total)
  ci_run_url: <GitHub Actions URL, if pushed>

notes: <free text>
```

Check the results from a clean state: `git clean -xfd` is destructive, so instead clone the final
branch into a new directory and run the full sequence there (`npm ci`, `db:generate`,
`db:migrate`, `lint`, `typecheck`, `test`, `build`, `test:e2e`).

## 6. Evaluate the applications

- Evaluate each application in a **separate browser session** (a fresh browser profile or a
  private window per application) so that local storage, cookies and cache cannot leak between
  them.
- Use the **same hardware, OS, browser version, window size and display scaling** for all three.
- Run each application with the same command (`npm run build && npm run start`, or `npm run dev`
  for all of them) and evaluate them one at a time.
- Save screenshots and recordings under `artifacts/screenshots/<run>/` on the run's branch, or in
  the operator's results folder.
- Score every application with the same rubric, ideally blind to which agent produced it.

## 7. Clean-up

```bash
git worktree remove ../aegis-astra   # repeat for each worktree, only after results are recorded
git worktree prune
```

Keep the `benchmark/*` branches (push them if you want CI results for each run).
