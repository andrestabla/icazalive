import { homedir } from "node:os";
import { join } from "node:path";

export function getLocalDatabasePath(): string {
  return (
    process.env.PGLITE_DATA_DIR ??
    join(homedir(), ".icaza-live", "pglite")
  );
}
