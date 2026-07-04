import { defineConfig, env } from "prisma/config";

// Prisma 7 config: the datasource URL lives here (read from DATABASE_URL) rather
// than in schema.prisma, so the schema stays credential-free. Prisma CLI
// commands (generate/migrate/studio) load this file automatically.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
