import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";

export const runtime = "nodejs";

export async function GET() {
  const db = getDb();
  const database = await db.execute(sql`select current_database() as database`);

  return NextResponse.json({
    status: "ok",
    application: "icaza-live",
    database: process.env.DATABASE_URL ? "postgresql" : "pglite-local",
    connection: database.rows[0],
    timestamp: new Date().toISOString(),
  });
}
