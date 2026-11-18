import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

const globalDb = globalThis as typeof globalThis & { aegisDb?: PrismaClient };

export const db =
  globalDb.aegisDb ??
  new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" }),
  });
if (process.env.NODE_ENV !== "production") globalDb.aegisDb = db;
