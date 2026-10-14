import "server-only";
import postgres from "postgres";

// Én tilkoblingspool per serverinstans. Neon sin «pooled» URL (PgBouncer) brukes i produksjon,
// derfor prepare: false. Holdes liten fordi Vercel kan kjøre mange instanser samtidig.

declare global {
  var __kolappSql: postgres.Sql | undefined;
}

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super("DATABASE_URL er ikke satt");
    this.name = "DatabaseNotConfiguredError";
  }
}

export function getSql(): postgres.Sql {
  if (globalThis.__kolappSql) return globalThis.__kolappSql;
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new DatabaseNotConfiguredError();
  const sql = postgres(url, {
    max: 3,
    // Lukk ledige tilkoblinger raskt og forny alle jevnlig, så en frosset serverinstans eller en Neon-database
    // som har sovet aldri gir et kall på en død tilkobling.
    idle_timeout: 20,
    max_lifetime: 60 * 10,
    connect_timeout: 10,
    prepare: false,
    onnotice: () => {},
  });
  globalThis.__kolappSql = sql;
  return sql;
}

export type Sql = postgres.Sql;
export type Tx = postgres.TransactionSql;
