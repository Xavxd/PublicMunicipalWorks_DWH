"""
verificar_scd.py
=============================================================================
Comprueba que el tipo de dimensión de cambio lenta que declara el capítulo sea
el que el SQL implementa de verdad.

Por qué existe
--------------
El artículo declaraba cinco dimensiones Tipo 2, dos Tipo 1 y tres Tipo 0. El
SQL implementaba siete, una y dos: dim_poblador y dim_propuesta llevaban
columnas de vigencia y disparadores que cerraban la fila vigente y abrían otra
—comportamiento Tipo 2— mientras el texto las daba por Tipo 1, y dim_fuente
hacía un upsert —Tipo 1— mientras el texto la daba por Tipo 0. Un revisor lo
encontró leyendo el repositorio.

El desacuerdo no era sólo de contabilidad: el artículo justificaba el Tipo 1
de las dimensiones ciudadanas diciendo que no conviene conservar registros
personales sustituidos, y la implementación conservaba cada versión con
nombre y CURP. La afirmación de privacidad era falsa por culpa del código.

La clasificación es una afirmación verificable sobre el esquema, así que se
verifica en lugar de confiarla a la memoria.

Cómo decide el tipo
-------------------
    Tipo 2  la tabla tiene fecha_efectiva, fecha_expiracion y es_actual, y
            algún disparador cierra la versión vigente antes de insertar
    Tipo 1  no versiona pero el disparador la actualiza (ON CONFLICT ... SET)
    Tipo 0  no versiona y nada la actualiza tras la carga inicial

Uso
---
    python scripts/verificar_scd.py
"""
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ESQUEMA = RAIZ / "db" / "arquitectura" / "ESQUEMA DEL DATA WAREHOUSE.sql"
TRIGGERS = RAIZ / "db" / "arquitectura" / "FUNCIONES Y TRIGGERS.sql"

# Lo que declara el capítulo (Tabla 2 y Sección 4.3).
DECLARADO = {
    "dim_obra": 2,
    "dim_region": 2,
    "dim_constructora": 2,
    "dim_personal": 2,
    "dim_presupuesto": 2,
    "dim_fuente": 1,
    "dim_poblador": 1,
    "dim_propuesta": 1,
    "dim_tiempo": 0,
    "dim_tipo_evento": 0,
}

COLUMNAS_VIGENCIA = ("fecha_efectiva", "fecha_expiracion", "es_actual")


def tipo_implementado(nombre, esquema, triggers):
    cuerpo = re.search(
        r"CREATE TABLE warehouse\." + nombre + r" \((.*?)\n\);", esquema, re.S)
    if not cuerpo:
        return None, f"{nombre} no existe en el esquema"
    versiona = all(c in cuerpo.group(1) for c in COLUMNAS_VIGENCIA)

    sync = re.search(
        r"FUNCTION warehouse\.sync_" + nombre.replace("dim_", "dim_") + r"\(\)(.*?)\$\$ LANGUAGE",
        triggers, re.S)
    cuerpo_sync = sync.group(1) if sync else ""
    cierra = "es_actual = FALSE" in cuerpo_sync
    actualiza = "DO UPDATE SET" in cuerpo_sync

    if versiona and cierra:
        return 2, None
    if versiona:
        return 2, f"{nombre} tiene columnas de vigencia pero ningún disparador las cierra"
    if actualiza:
        return 1, None
    return 0, None


def main():
    esquema = ESQUEMA.read_text(encoding="utf-8")
    triggers = TRIGGERS.read_text(encoding="utf-8")

    problemas = []
    cuenta = {0: 0, 1: 0, 2: 0}
    print(f"{'dimensión':22} {'declarado':>10} {'implementado':>13}")
    for nombre, declarado in DECLARADO.items():
        real, aviso = tipo_implementado(nombre, esquema, triggers)
        if aviso:
            problemas.append(aviso)
        marca = "" if real == declarado else "   <-- NO COINCIDE"
        print(f"  {nombre:20} {'Tipo ' + str(declarado):>10} {'Tipo ' + str(real):>13}{marca}")
        if real != declarado:
            problemas.append(f"{nombre}: el capítulo dice Tipo {declarado}, el SQL implementa Tipo {real}")
        cuenta[real] = cuenta.get(real, 0) + 1

    print(f"\nreparto implementado: {cuenta[2]} Tipo 2, {cuenta[1]} Tipo 1, {cuenta[0]} Tipo 0")

    # Ninguna dimensión con datos personales debe versionar.
    for nombre in ("dim_poblador", "dim_propuesta"):
        cuerpo = re.search(r"CREATE TABLE warehouse\." + nombre + r" \((.*?)\n\);", esquema, re.S)
        if cuerpo and any(c in cuerpo.group(1) for c in COLUMNAS_VIGENCIA):
            problemas.append(
                f"{nombre} versiona: el capítulo afirma que los registros personales "
                f"sustituidos no se conservan")

    if problemas:
        print()
        for p in problemas:
            print("  " + p)
        sys.exit(f"{len(problemas)} discrepancia(s) entre el capítulo y el SQL")
    print("el SQL coincide con lo que declara el capítulo")


if __name__ == "__main__":
    main()
