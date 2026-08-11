import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import postgres from "postgres";
import * as schema from "./schema";
import { getLocalDatabasePath } from "./local-path";

type LocalDatabase = ReturnType<typeof drizzlePglite<typeof schema>>;

const globalDatabase = globalThis as typeof globalThis & {
  icazaDatabase?: LocalDatabase;
};

export function getDb(): LocalDatabase {
  if (globalDatabase.icazaDatabase) return globalDatabase.icazaDatabase;

  if (process.env.DATABASE_URL) {
    const client = postgres(process.env.DATABASE_URL, {
      max: process.env.NODE_ENV === "production" ? 10 : 1,
      prepare: false,
    });
    globalDatabase.icazaDatabase = drizzlePostgres(client, {
      schema,
    }) as unknown as LocalDatabase;
  } else {
    // PGlite guarda en el disco local del proceso. En un entorno desplegado
    // (Replit, contenedores) ese disco es efímero: los datos se perderían en
    // cada reinicio, así que se exige DATABASE_URL de forma explícita.
    if (process.env.NODE_ENV === "production" && !process.env.ALLOW_EPHEMERAL_DB) {
      throw new Error(
        "Falta DATABASE_URL. En producción Icaza Live requiere PostgreSQL administrado; " +
          "PGlite guarda en disco efímero y perdería los datos en cada reinicio. " +
          "Define DATABASE_URL, o ALLOW_EPHEMERAL_DB=1 si aceptas datos temporales.",
      );
    }
    const dataDirectory = getLocalDatabasePath();
    mkdirSync(dirname(dataDirectory), { recursive: true });
    const client = new PGlite(dataDirectory);
    globalDatabase.icazaDatabase = drizzlePglite(client, { schema });
  }

  return globalDatabase.icazaDatabase;
}
