"""
registrar_imagenes.py
=============================================================================
Sincroniza las galerías de docs/js/static_backend.js con lo que hay realmente
en docs/img/obras/.

Por qué existe
--------------
Las rutas de las imágenes son el único punto de la semilla que depende de
archivos externos: si una lista nombra un archivo que no está, el visor
publicado enseña un hueco, y si un archivo está pero nadie lo añadió a la
lista, no se ve nunca. Las dos cosas son fáciles de provocar editando a mano
—sobre todo cuando las imágenes las produce otra persona en otro momento— y
ninguna se nota hasta que alguien abre la galería en producción. Aquí la
carpeta es la fuente de verdad y la semilla se deriva de ella.

Convención de nombres
---------------------
    obr-001-3.webp          tercera toma de la obra terminada
    obr-001-antes-3.webp    el mismo encuadre antes de la obra

El emparejamiento es por posición: `antes-3` es la pareja de la toma 3. Una
obra puede tener «antes» de sólo algunas tomas; el visor enseña el conmutador
únicamente en ésas.

Uso
---
    python scripts/registrar_imagenes.py             # escribe
    python scripts/registrar_imagenes.py --verificar # sólo comprueba (CI)

Sube SEED_VERSION cuando algo cambia, que es lo que hace que un visitante con
la demostración ya abierta reciba la galería nueva en lugar de la que tuviera
guardada en su pestaña.
"""
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
IMAGENES = RAIZ / "docs" / "img" / "obras"
SEMILLA = RAIZ / "docs" / "js" / "static_backend.js"
PREFIJO = "img/obras"

PATRON = re.compile(r"^obr-(\d{3})-(antes-)?(\d+)\.webp$")


def inventario():
    """{'OBR-001': {'despues': [...], 'antes': {3: 'ruta'}}} desde la carpeta."""
    obras = {}
    for ruta in sorted(IMAGENES.glob("*.webp")):
        m = PATRON.match(ruta.name)
        if not m:
            print(f"  aviso: {ruta.name} no sigue la convención, se ignora")
            continue
        obra = f"OBR-{m.group(1)}"
        entrada = obras.setdefault(obra, {"despues": {}, "antes": {}})
        clave = "antes" if m.group(2) else "despues"
        entrada[clave][int(m.group(3))] = f"{PREFIJO}/{ruta.name}"
    return obras


def listas(entrada):
    """Las dos listas paralelas: «después» en orden, «antes» alineado a hueco."""
    orden = sorted(entrada["despues"])
    despues = [entrada["despues"][k] for k in orden]
    antes = [entrada["antes"].get(k, "") for k in orden]
    # Los huecos intermedios importan (alinean las posiciones), los del final no.
    while antes and not antes[-1]:
        antes.pop()
    return despues, antes


def formatear(nombre, rutas, sangria):
    if not rutas:
        return ""
    cuerpo = ", ".join(f'"{r}"' for r in rutas)
    return f"{sangria}{nombre}: [{cuerpo}],\n"


def sincronizar(texto, obras):
    cambios = []
    for obra, entrada in sorted(obras.items()):
        despues, antes = listas(entrada)
        bloque = re.search(
            r'(\n(?P<sangria>[ ]*)imagenes: \[[^\]]*\],\n)'
            r'(?P<viejo_antes>[ ]*imagenesAntes: \[[^\]]*\],\n)?',
            texto[texto.index(f'id: "{obra}"'):],
        )
        if not bloque:
            print(f"  aviso: {obra} no tiene campo imagenes en la semilla")
            continue
        inicio = texto.index(f'id: "{obra}"')
        sangria = bloque.group("sangria")
        nuevo = "\n" + formatear("imagenes", despues, sangria) + formatear("imagenesAntes", antes, sangria)
        viejo = bloque.group(0)
        if nuevo != viejo:
            cambios.append(f"{obra}: {len(despues)} después, {sum(1 for a in antes if a)} antes")
            texto = texto[:inicio] + texto[inicio:].replace(viejo, nuevo, 1)
    return texto, cambios


def subir_version(texto):
    m = re.search(r"const SEED_VERSION = (\d+);", texto)
    nueva = int(m.group(1)) + 1
    return texto.replace(m.group(0), f"const SEED_VERSION = {nueva};", 1), nueva


def main():
    verificar = "--verificar" in sys.argv
    obras = inventario()
    if not obras:
        sys.exit(f"No hay imágenes en {IMAGENES}")

    original = SEMILLA.read_text(encoding="utf-8")
    texto, cambios = sincronizar(original, obras)

    if not cambios:
        print(f"Al día: {len(obras)} obras, {sum(len(o['despues']) + len(o['antes']) for o in obras.values())} imágenes")
        return

    if verificar:
        for c in cambios:
            print(f"  {c}")
        sys.exit("La semilla no coincide con docs/img/obras/. Corre el script sin --verificar.")

    texto, version = subir_version(texto)
    SEMILLA.write_text(texto, encoding="utf-8", newline="")
    for c in cambios:
        print(f"  {c}")
    print(f"static_backend.js actualizado, SEED_VERSION = {version}")
    print("Regenera también el mapa: node scripts/generar_snapshot_mapa.mjs")


if __name__ == "__main__":
    main()
