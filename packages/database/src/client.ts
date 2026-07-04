import { PrismaClient } from "../generated/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

// A single shared Prisma client. Each PrismaClient opens its own connection
// pool, so we reuse one instance per process. The `globalThis` guard mirrors the
// server's port-reuse pattern (see CLAUDE.md `globalThis.__server`): under
// `bun --hot` the module re-evaluates in-process on every reload, and without
// the guard each reload would leak a new pool.
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

const prisma = globalThis.__prisma ?? new PrismaClient({ adapter });
if (process.env.NODE_ENV !== "production") globalThis.__prisma = prisma;

export { prisma };
