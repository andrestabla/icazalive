import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import postgres from "postgres";
import { getLocalDatabasePath } from "../db/local-path";

const migrationsFolder = "./drizzle";

if (process.env.DATABASE_URL) {
  const client = postgres(process.env.DATABASE_URL, { max: 1 });
  await migratePostgres(drizzlePostgres(client), { migrationsFolder });
  await client.end();
  console.log("Migraciones aplicadas en PostgreSQL.");
} else {
  const dataDirectory = getLocalDatabasePath();
  mkdirSync(dirname(dataDirectory), { recursive: true });
  const client = new PGlite(dataDirectory);
  await migratePglite(drizzlePglite(client), { migrationsFolder });
  await client.close();
  console.log("Migraciones aplicadas en PostgreSQL local (PGlite).");
}
