import { mkdirSync, mkdtempSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";

const port = process.argv[2] ?? "3102";
mkdirSync("test-results", { recursive: true });
const folder = mkdtempSync("test-results/mission-db-");
const env = {
  ...process.env,
  DATABASE_URL: "file:./" + folder.replaceAll("\\", "/") + "/e2e.db",
  NEXT_TELEMETRY_DISABLED: "1",
};
const migration = spawnSync(
  process.execPath,
  ["node_modules/prisma/build/index.js", "migrate", "deploy"],
  {
    env,
    stdio: "inherit",
  },
);
if (migration.error) throw migration.error;
if (migration.status !== 0) process.exit(migration.status ?? 1);

const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    process.env.PLAYWRIGHT_PRODUCTION === "1" ? "start" : "dev",
    "--port",
    port,
  ],
  { env, stdio: "inherit" },
);
child.on("error", (error) => {
  throw error;
});
child.on("exit", (code) => (process.exitCode = code ?? 1));
