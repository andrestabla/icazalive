#!/usr/bin/env python3
"""La raíz vuelve a llevar al acceso del equipo; la portada informativa queda en /info."""
import re, sys, pathlib
root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")
p = root / "app/page.tsx"
s = p.read_text()

if "PublicHome" in s:
    # Quitar el bloque de visitante sin sesión y el import del componente.
    s2, n1 = re.subn(
        r'\n?\s*// Visitantes sin sesión: portada pública del dominio\.\n\s*const visitor = await getCurrentUser\(\);\n\s*if \(!visitor\) return <PublicHome />;\n\n',
        "\n", s, count=1, flags=re.S)
    if n1 != 1:
        print("ANCLA NO ENCONTRADA: bloque de visitante"); sys.exit(1)
    s2, n2 = re.subn(r'import PublicHome from "\./public-home";\n', "", s2, count=1)
    if n2 != 1:
        print("ANCLA NO ENCONTRADA: import de PublicHome"); sys.exit(1)
    # getCurrentUser ya no se usa en esta página.
    m = re.search(r'import \{([^}]*)\} from "@/lib/auth";', s2)
    if m and "getCurrentUser" in m.group(1) and s2.count("getCurrentUser") == 1:
        names = [n.strip() for n in m.group(1).split(",") if n.strip() and n.strip() != "getCurrentUser"]
        s2 = re.sub(r'import \{[^}]*\} from "@/lib/auth";',
                    'import { ' + ", ".join(names) + ' } from "@/lib/auth";', s2, count=1)
    p.write_text(s2)
    print("ok raíz -> acceso del equipo")
else:
    print("raíz ya apunta al acceso del equipo")
