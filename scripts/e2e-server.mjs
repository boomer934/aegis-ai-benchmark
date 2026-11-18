import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync } from "node:fs";
import path from "node:path";

const dir = path.resolve("prisma/.test");
mkdirSync(dir, { recursive: true });
const db = path.join(mkdtempSync(path.join(dir, "mission-db-")), "missions.db");
const env = {
  ...process.env,
  DATABASE_URL: "file:./" + path.relative(process.cwd(), db).split(path.sep).join("/"),
  NEXT_TELEMETRY_DISABLED: "1",
};
const migrate = spawnSync(
  process.execPath,
  ["node_modules/prisma/build/index.js", "migrate", "deploy"],
  { env, stdio: "inherit" },
);
if (migrate.status !== 0) process.exit(migrate.status ?? 1);
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    process.env.AEGIS_E2E_DEV === "1" ? "dev" : "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    process.env.PLAYWRIGHT_PORT ?? "3101",
  ],
  { env, stdio: "inherit" },
);
process.on("SIGTERM", () => server.kill());
process.on("SIGINT", () => server.kill());
server.on("exit", (code) => process.exit(code ?? 0));
