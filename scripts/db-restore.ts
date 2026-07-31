// Restauración: npm run db:restore -- <carpeta-del-respaldo>
// Ejecutar con el servidor detenido. Reemplaza la base y los medios actuales.
import { cpSync, existsSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { getLocalDatabasePath } from "../db/local-path";

const source = process.argv[2];
if (!source || !existsSync(join(source, "pglite"))) {
  console.error("Uso: npm run db:restore -- <carpeta-del-respaldo> (debe contener pglite/)");
  process.exit(1);
}
const dataDir = getLocalDatabasePath();
rmSync(dataDir, { recursive: true, force: true });
cpSync(join(source, "pglite"), dataDir, { recursive: true });

const mediaBackup = join(source, "media");
if (existsSync(mediaBackup)) {
  const mediaDir = process.env.ICAZA_MEDIA_DIR ?? join(homedir(), ".icaza-live", "media");
  rmSync(mediaDir, { recursive: true, force: true });
  cpSync(mediaBackup, mediaDir, { recursive: true });
}
console.log("Base y medios restaurados desde:", source);
