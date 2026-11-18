import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Prisma client singleton. Prisma 7 runs queries through a driver adapter; the
 * libSQL adapter talks to the local SQLite file without native compilation.
 * The instance is cached on globalThis so dev-mode hot reloads reuse it.
 */
const globalForPrisma = globalThis as unknown as { aegisPrisma?: PrismaClient };

function createClient(): PrismaClient {
  const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  return new PrismaClient({ adapter: new PrismaLibSql({ url }) });
}

export function getDb(): PrismaClient {
  if (!globalForPrisma.aegisPrisma) globalForPrisma.aegisPrisma = createClient();
  return globalForPrisma.aegisPrisma;
}
