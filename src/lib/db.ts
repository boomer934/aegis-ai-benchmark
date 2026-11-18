import { PrismaClient } from "@/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
const shared = globalThis as typeof globalThis & { facilityDb?: PrismaClient };
export function database() {
  return (shared.facilityDb ??= new PrismaClient({
    adapter: new PrismaLibSql({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" }),
  }));
}
