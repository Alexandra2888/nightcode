// Type-only barrel for the database package.
//
// This is the package's default entry (`nightcode-database`). It re-exports the
// Prisma-generated model and enum *types* — nothing runtime — so consumers that
// only need the shared shapes (notably the CLI) can `import type { … }` from
// here without pulling the Prisma client, driver adapter, or `pg` into their
// bundle. The runtime client lives behind the `./client` subpath instead.
export type { Session, Message, Prisma } from "../generated/client.ts";
export type { Role } from "../generated/enums.ts";
