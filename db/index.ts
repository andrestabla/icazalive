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
    const dataDirectory = getLocalDatabasePath();
    mkdirSync(dirname(dataDirectory), { recursive: true });
    const client = new PGlite(dataDirectory);
    globalDatabase.icazaDatabase = drizzlePglite(client, { schema });
  }

  return globalDatabase.icazaDatabase;
}
