import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";

export const runtime = "nodejs";

export async function GET() {
  const db = getDb();
  const database = await db.execute(sql`select current_database() as database`);
  // postgres-js devuelve el arreglo de filas directamente; PGlite lo envuelve
  // en { rows }. Se normaliza para que el healthcheck funcione en ambos.
  const row = Array.isArray(database) ? database[0] : (database.rows?.[0] ?? null);

  return NextResponse.json({
    status: "ok",
    application: "icaza-live",
    database: process.env.DATABASE_URL ? "postgresql" : "pglite-local",
    connection: row,
    timestamp: new Date().toISOString(),
  });
}
