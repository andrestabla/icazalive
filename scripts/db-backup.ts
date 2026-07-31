// Respaldo local: copia la base PGlite y los medios a ~/.icaza-live/backups.
// Ejecutar con el servidor detenido: npm run db:backup
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { getLocalDatabasePath } from "../db/local-path";

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const target = join(homedir(), ".icaza-live", "backups", `backup-${stamp}`);
mkdirSync(target, { recursive: true });

const dataDir = getLocalDatabasePath();
if (!existsSync(dataDir)) {
  console.error("No existe la base local:", dataDir);
  process.exit(1);
}
cpSync(dataDir, join(target, "pglite"), { recursive: true });

const mediaDir = process.env.ICAZA_MEDIA_DIR ?? join(homedir(), ".icaza-live", "media");
if (existsSync(mediaDir)) {
  cpSync(mediaDir, join(target, "media"), { recursive: true });
}
console.log("Respaldo creado en:", target);
