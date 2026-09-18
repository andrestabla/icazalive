#!/usr/bin/env python3
"""Muestra la portada pública en la raíz a los visitantes sin sesión, con su
propio título. El comportamiento con sesión no cambia. Ediciones ancladas."""
import re, sys, pathlib
root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")
p = root / "app/page.tsx"
s = p.read_text()
hecho = []

def sub(pattern, repl):
    global s
    new, n = re.subn(pattern, repl, s, count=1, flags=re.S)
    if n != 1:
        print("ANCLA NO ENCONTRADA:", pattern[:70]); sys.exit(1)
    s = new

# 1) Importar getCurrentUser junto a requirePageUser y el componente público.
if "PublicHome" not in s:
    m = re.search(r'import \{([^}]*)\} from "@/lib/auth";', s)
    if not m:
        print("ANCLA NO ENCONTRADA: import de @/lib/auth"); sys.exit(1)
    names = [n.strip() for n in m.group(1).split(",") if n.strip()]
    if "getCurrentUser" not in names:
        names.append("getCurrentUser")
    sub(r'import \{[^}]*\} from "@/lib/auth";',
        lambda _m: 'import { ' + ", ".join(sorted(names)) + ' } from "@/lib/auth";\nimport PublicHome from "./public-home";')

    # 2) Sin sesión se sirve la portada pública en lugar de redirigir al acceso.
    sub(r'(export default async function Home\(\) \{\n)',
        r'''\1  // Visitantes sin sesión: portada pública del dominio.
  const visitor = await getCurrentUser();
  if (!visitor) return <PublicHome />;

''')
    hecho.append("portada")

# 3) Título propio para la portada pública.
if "generateMetadata" not in s:
    sub(r'(export default async function Home\(\) \{\n)',
        r'''export async function generateMetadata() {
  const viewer = await getCurrentUser();
  if (viewer) return {};
  return {
    title: "Icaza Jammoul Live — Plataforma de eventos corporativos",
    description:
      "Plataforma con la que Icaza Jammoul organiza y transmite sus eventos corporativos en vivo, híbridos y simulados: registro de asistentes, sala de transmisión e interacción en vivo.",
  };
}

\1''')
    hecho.append("título")

if hecho:
    p.write_text(s)
    print("ok", ", ".join(hecho))
else:
    print("ya aplicado")
