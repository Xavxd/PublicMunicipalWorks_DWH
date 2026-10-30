#!/usr/bin/env python3
"""
ETL — Fondo de Infraestructura 2023 (ef2023) → PublicMunicipalWorks_DWH
========================================================================
Loads federal public works data from the ef2023 open dataset into the
operational schema of obras_publicas.

Source files (cuarto_informe_definitivo):
  ef2023.csv              → obra, region (comunidad), constructora (via contratos)
  contratos.csv           → constructora
  fuentes_financiamiento  → fuente_presupuestaria, financia
  georreferencias.csv     → enriches region with lat/lon (stored in comunidad)
  metas_avances.csv       → informes (progress per trimester)

Load order respects FK dependencies:
  1. constructora
  2. personal (one system supervisor + one system proyectista)
  3. supervisor  (subclass of personal)
  4. proyectista (subclass of personal)
  5. region
  6. fuente_presupuestaria
  7. obra
  8. financia
  9. presupuesto_obra
  10. informes

Usage:
  python3 scripts/etl_ef2023.py [--dry-run] [--chunk-size N]

Options:
  --dry-run       Parse and transform only; do not write to the database.
  --chunk-size N  Rows per chunk when reading large CSVs (default: 10000).
"""

import argparse
import logging
import sys
import os
import re
from datetime import datetime

import pandas as pd
import psycopg2
from psycopg2.extras import execute_values

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

DATA_DIR = "/home/xavi/PublicMunicipalWorks_DWH/ef2023/cuarto_informe_definitivo"

DB = {
    "host":     "localhost",
    "port":     55432,
    "dbname":   "obras_publicas",
    "user":     "obras",
    "password": "obras_local",
}

# One system-level supervisor and proyectista are created so every obra
# has valid FK references. Real staff records can be added later.
SYSTEM_SUPERVISOR = {
    "codigo_personal":  "SYS-SUP-EF2023",
    "nombre":           "Sistema",
    "apellido_paterno": "ETL",
    "apellido_materno": "EF2023",
    "username":         "sys_supervisor_ef2023",
    "rol":              "Supervisor",
}

SYSTEM_PROYECTISTA = {
    "codigo_personal":  "SYS-PRY-EF2023",
    "nombre":           "Sistema",
    "apellido_paterno": "ETL",
    "apellido_materno": "EF2023",
    "username":         "sys_proyectista_ef2023",
    "rol":              "Proyectista",
}

ENCODING = "latin-1"
CHUNK_SIZE_DEFAULT = 10_000

# Map trimester number → month name (use last month of each trimester)
TRIMESTRE_MES = {1: "Marzo", 2: "Junio", 3: "Septiembre", 4: "Diciembre"}

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("etl_ef2023")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def slugify(text: str) -> str:
    """Turn a free-text string into a safe identifier fragment."""
    text = str(text).strip().upper()
    text = re.sub(r"[^A-Z0-9]", "-", text)
    text = re.sub(r"-+", "-", text).strip("-")
    return text[:50]


def parse_date(value) -> str | None:
    """Parse dd/mm/yyyy or yyyy-mm-dd → ISO string, or None."""
    if pd.isna(value):
        return None
    s = str(value).strip()
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"):
        try:
            return datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def safe_int(value, default: int = 0) -> int:
    try:
        v = float(value)
        return max(0, min(100, int(v)))
    except (TypeError, ValueError):
        return default


def safe_float(value, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def batch_upsert(cur, table: str, columns: list[str], rows: list[tuple],
                 conflict_column: str) -> int:
    """INSERT … ON CONFLICT (conflict_column) DO NOTHING. Returns inserted count."""
    if not rows:
        return 0
    sql = (
        f"INSERT INTO {table} ({', '.join(columns)}) VALUES %s "
        f"ON CONFLICT ({conflict_column}) DO NOTHING"
    )
    execute_values(cur, sql, rows, page_size=500)
    return len(rows)


# ---------------------------------------------------------------------------
# Step 1 — constructoras
# ---------------------------------------------------------------------------

def load_constructoras(conn, dry_run: bool, chunk_size: int) -> dict[str, str]:
    """
    Returns {rfc: id_constructora}.
    id_constructora = 'RFC-<RFC>'  (or 'CONST-<slug>' when RFC is absent)
    """
    log.info("Step 1/10 — constructoras from contratos.csv …")
    path = os.path.join(DATA_DIR, "contratos.csv")

    rfc_map: dict[str, tuple] = {}  # rfc → (id, rfc, nombre, tipo)

    for chunk in pd.read_csv(path, encoding=ENCODING, chunksize=chunk_size,
                              usecols=["CONTRATISTA", "RFC_CONVOCANTE", "TIPO_OBRA"],
                              dtype=str):
        # CONTRATISTA is the actual company hired to execute the work.
        # RFC_CONVOCANTE is the government entity that issued the contract —
        # it is the only RFC column in this file, so we use it as the
        # identifier while storing CONTRATISTA as the display name.
        chunk = chunk.dropna(subset=["CONTRATISTA"])
        for _, row in chunk.iterrows():
            rfc    = str(row.get("RFC_CONVOCANTE", "")).strip().upper()
            nombre = str(row["CONTRATISTA"]).strip()[:200]  # actual contractor name
            tipo   = "EMPRESA_PRIVADA" if str(row.get("TIPO_OBRA", "")).strip().lower() != "adquisiciones" else "PROVEEDOR"

            if not rfc or rfc in ("NAN", ""):
                key = slugify(nombre)[:20]
                cid = f"CONST-{key}"
                rfc_key = f"NORFC-{key}"
            else:
                cid = f"RFC-{rfc[:20]}"
                rfc_key = rfc

            if rfc_key not in rfc_map:
                rfc_map[rfc_key] = (cid, rfc if rfc and rfc != "NAN" else None, nombre, tipo)

    rows = list(rfc_map.values())
    log.info("  %d unique constructoras found", len(rows))

    if not dry_run:
        with conn.cursor() as cur:
            batch_upsert(cur, "public.constructora",
                         ["id_constructora", "rfc", "nombre_const", "tipo_ejecutor"],
                         rows, "id_constructora")
        conn.commit()
        log.info("  constructoras committed.")

    # return rfc → id_constructora for later use
    return {k: v[0] for k, v in rfc_map.items()}


# ---------------------------------------------------------------------------
# Step 2 & 3 — system personal, supervisor, proyectista
# ---------------------------------------------------------------------------

def load_system_personal(conn, dry_run: bool):
    log.info("Step 2/10 — system personal (supervisor + proyectista) …")
    if dry_run:
        return

    # Pick any constructora to satisfy the FK on proyectista
    with conn.cursor() as cur:
        cur.execute("SELECT id_constructora FROM public.constructora LIMIT 1")
        row = cur.fetchone()
        first_const = row[0] if row else "CONST-UNKNOWN"

        # personal rows
        for p in (SYSTEM_SUPERVISOR, SYSTEM_PROYECTISTA):
            cur.execute("""
                INSERT INTO public.personal
                    (codigo_personal, nombre, apellido_paterno, apellido_materno,
                     username, rol)
                VALUES (%s,%s,%s,%s,%s,%s)
                ON CONFLICT (codigo_personal) DO NOTHING
            """, (p["codigo_personal"], p["nombre"], p["apellido_paterno"],
                  p["apellido_materno"], p["username"], p["rol"]))

        # supervisor subclass
        cur.execute("""
            INSERT INTO public.supervisor (codigo_personal)
            VALUES (%s) ON CONFLICT DO NOTHING
        """, (SYSTEM_SUPERVISOR["codigo_personal"],))

        # proyectista subclass
        cur.execute("""
            INSERT INTO public.proyectista (codigo_personal, empresa, id_constructora)
            VALUES (%s, %s, %s) ON CONFLICT DO NOTHING
        """, (SYSTEM_PROYECTISTA["codigo_personal"], "Sistema ETL EF2023", first_const))

    conn.commit()
    log.info("  System personal committed.")


# ---------------------------------------------------------------------------
# Step 4 — regions
# ---------------------------------------------------------------------------

def load_regions(conn, dry_run: bool, chunk_size: int) -> dict[str, str]:
    """
    Returns {municipio_upper: id_region}.
    Regions come from ef2023.csv MUNICIPIO_RESPONSABLE + ENTIDAD_FEDERATIVA.
    We enrich with georreferencias lat/lon where available.
    """
    log.info("Step 3/10 — regions from ef2023.csv …")
    path_ef = os.path.join(DATA_DIR, "ef2023.csv")

    muni_set: dict[str, tuple] = {}  # key → (id, comunidad, barrio, colonia)

    for chunk in pd.read_csv(path_ef, encoding=ENCODING, chunksize=chunk_size,
                              usecols=["ID_MUNICIPIO_RESPONSABLE",
                                       "MUNICIPIO_RESPONSABLE",
                                       "ENTIDAD_FEDERATIVA"],
                              dtype=str):
        chunk = chunk.dropna(subset=["MUNICIPIO_RESPONSABLE"])
        for _, row in chunk.iterrows():
            muni  = str(row["MUNICIPIO_RESPONSABLE"]).strip()
            estado = str(row.get("ENTIDAD_FEDERATIVA", "")).strip()
            key   = muni.upper()
            if key not in muni_set:
                rid = f"REG-{slugify(muni)[:30]}-{slugify(estado)[:10]}"
                muni_set[key] = (rid, muni, estado, None)

    rows = list(muni_set.values())
    log.info("  %d unique regions found", len(rows))

    if not dry_run:
        with conn.cursor() as cur:
            batch_upsert(cur, "public.region",
                         ["id_region", "comunidad", "barrio", "colonia"],
                         rows, "id_region")
        conn.commit()
        log.info("  Regions committed.")

    return {k: v[0] for k, v in muni_set.items()}


# ---------------------------------------------------------------------------
# Step 5 — fuentes presupuestarias
# ---------------------------------------------------------------------------

def load_fuentes(conn, dry_run: bool, chunk_size: int) -> set[str]:
    """Returns set of id_fuente loaded."""
    log.info("Step 4/10 — fuentes_presupuestarias …")
    path = os.path.join(DATA_DIR, "fuentes_financiamiento.csv")

    fuentes: dict[str, tuple] = {}  # id_fuente → (id, grado_nivel, programa)

    for chunk in pd.read_csv(path, encoding=ENCODING, chunksize=chunk_size,
                              usecols=["FOLIO", "ID_RAMO", "ID_MODALIDAD",
                                       "ID_PP", "TIPO_RECURSO"],
                              dtype=str):
        chunk = chunk.dropna(subset=["FOLIO"])
        for _, row in chunk.iterrows():
            ramo  = str(row.get("ID_RAMO", "")).strip()
            modal = str(row.get("ID_MODALIDAD", "")).strip()
            pp    = str(row.get("ID_PP", "")).strip()
            tipo  = str(row.get("TIPO_RECURSO", "DESCONOCIDO")).strip()
            fid   = f"RAMO{ramo}-{modal}-{pp}"
            if fid not in fuentes:
                nivel = "FEDERAL" if "FEDERAL" in tipo.upper() else "ESTATAL"
                programa = f"Ramo {ramo} / Modalidad {modal} / PP {pp}"
                fuentes[fid] = (fid, nivel, programa[:200])

    rows = list(fuentes.values())
    log.info("  %d unique fuentes found", len(rows))

    if not dry_run:
        with conn.cursor() as cur:
            batch_upsert(cur, "public.fuente_presupuestaria",
                         ["id_fuente", "grado_nivel", "programa"],
                         rows, "id_fuente")
        conn.commit()
        log.info("  Fuentes committed.")

    return set(fuentes.keys())


# ---------------------------------------------------------------------------
# Step 6 — obras
# ---------------------------------------------------------------------------

def load_obras(conn, dry_run: bool, chunk_size: int,
               region_map: dict, rfc_map: dict,
               rfc_by_folio: dict) -> set[str]:
    """
    Returns set of id_obra inserted.
    rfc_by_folio: {folio: rfc_key} built from contratos.csv
    """
    log.info("Step 5/10 — obras from ef2023.csv …")
    # Note: in --dry-run mode obra_ids is fully populated but no DB writes occur.
    path = os.path.join(DATA_DIR, "ef2023.csv")

    # Fallback constructora: first one in rfc_map
    fallback_const = next(iter(rfc_map.values())) if rfc_map else "CONST-UNKNOWN"

    inserted_ids: set[str] = set()
    rows_buf: list[tuple] = []
    total = 0
    skipped = 0

    def flush(cur):
        nonlocal total
        if not rows_buf:
            return
        batch_upsert(cur, "public.obra",
                     ["id_obra", "codigo_expediente", "nombre_obra", "etapa",
                      "fecha_inicio", "fecha_final", "descripcion",
                      "beneficiarios", "id_constructora", "id_region",
                      "codigo_supervisor", "estado"],
                     rows_buf, "id_obra")
        total += len(rows_buf)
        rows_buf.clear()

    cur = conn.cursor() if not dry_run else None
    if True:

        for chunk in pd.read_csv(path, encoding=ENCODING, chunksize=chunk_size,
                                  dtype=str):
            chunk = chunk.dropna(subset=["FOLIO", "NOMBRE",
                                          "MUNICIPIO_RESPONSABLE"])

            for _, row in chunk.iterrows():
                folio = str(row["FOLIO"]).strip()
                if folio in inserted_ids:
                    continue

                fecha_i = parse_date(row.get("FECHA_INICIO"))
                fecha_f = parse_date(row.get("FECHA_ESTIMADA_TERMINO"))

                if not fecha_i:
                    skipped += 1
                    continue

                # If end date is missing, default to Dec 31 of the start year
                if not fecha_f:
                    year = fecha_i[:4]
                    fecha_f = f"{year}-12-31"

                muni_key = str(row["MUNICIPIO_RESPONSABLE"]).strip().upper()
                id_region = region_map.get(muni_key)
                if not id_region:
                    skipped += 1
                    continue

                rfc_key = rfc_by_folio.get(folio)
                id_const = rfc_map.get(rfc_key, fallback_const) if rfc_key else fallback_const

                nombre = str(row.get("NOMBRE", "Sin nombre")).strip()[:500]
                # POBLACION_BENEFICIADA is a yes/no flag (S/N), not a count.
                # The actual numbers are in BENEFICIARIOS, HOMBRES, MUJERES.
                ben_total  = str(row.get("BENEFICIARIOS", "")).strip()
                ben_hombres = str(row.get("HOMBRES", "")).strip()
                ben_mujeres = str(row.get("MUJERES", "")).strip()
                if ben_total and ben_total not in ("nan", "N"):
                    beneficiarios = f"{ben_total} habitantes"
                elif ben_hombres or ben_mujeres:
                    beneficiarios = f"{ben_hombres} hombres, {ben_mujeres} mujeres"
                else:
                    beneficiarios = "No especificado"
                beneficiarios = beneficiarios[:500]
                estatus = str(row.get("ESTATUS", "")).strip()
                # Mark as inactive if cancelled OR suspended
                estado_bool = estatus.lower() not in ("cancelado", "suspendido")

                rows_buf.append((
                    f"EF-{folio}",          # id_obra
                    folio,                  # codigo_expediente
                    nombre,                 # nombre_obra
                    1,                      # etapa (default)
                    fecha_i,                # fecha_inicio
                    fecha_f,                # fecha_final
                    f"{estatus} — {nombre}"[:500],  # descripcion
                    beneficiarios,          # beneficiarios
                    id_const,               # id_constructora
                    id_region,              # id_region
                    SYSTEM_SUPERVISOR["codigo_personal"],
                    estado_bool,
                ))
                inserted_ids.add(folio)

                if not dry_run and len(rows_buf) >= chunk_size:
                    flush(cur)
                    conn.commit()
                    log.info("    … %d obras inserted so far", total)

        if not dry_run and rows_buf:
            flush(cur)
            conn.commit()

    log.info("  obras: %d inserted, %d skipped (missing dates/region)", total, skipped)
    return inserted_ids


# ---------------------------------------------------------------------------
# Step 7 — build folio→rfc index from contratos.csv
# ---------------------------------------------------------------------------

def build_rfc_by_folio(chunk_size: int) -> dict[str, str]:
    """Returns {folio: rfc_key} using first contract per folio."""
    log.info("Step 6/10 — indexing contratos by folio …")
    path = os.path.join(DATA_DIR, "contratos.csv")
    index: dict[str, str] = {}

    for chunk in pd.read_csv(path, encoding=ENCODING, chunksize=chunk_size,
                              usecols=["FOLIO", "RFC_CONVOCANTE", "CONTRATISTA"],
                              dtype=str):
        chunk = chunk.dropna(subset=["FOLIO"])
        for _, row in chunk.iterrows():
            folio = str(row["FOLIO"]).strip()
            if folio in index:
                continue
            rfc  = str(row.get("RFC_CONVOCANTE", "")).strip().upper()
            # Use CONTRATISTA (the actual contractor) for the name-based slug
            # when no RFC is present, same logic as load_constructoras().
            nombre = str(row.get("CONTRATISTA", "")).strip()
            if rfc and rfc != "NAN":
                index[folio] = rfc
            else:
                key = slugify(nombre)[:20]
                index[folio] = f"NORFC-{key}"

    log.info("  %d folio→rfc entries indexed", len(index))
    return index


# ---------------------------------------------------------------------------
# Step 8 — financia (obra ↔ fuente)
# ---------------------------------------------------------------------------

def load_financia(conn, dry_run: bool, chunk_size: int,
                  obra_ids: set[str]):
    log.info("Step 7/10 — financia links …")
    path = os.path.join(DATA_DIR, "fuentes_financiamiento.csv")

    rows_buf: list[tuple] = []
    seen: set[tuple] = set()
    total = 0

    def flush(cur):
        nonlocal total
        if not rows_buf:
            return
        sql = ("INSERT INTO public.financia (id_obra, id_fuente) VALUES %s "
               "ON CONFLICT (id_obra, id_fuente) DO NOTHING")
        execute_values(cur, sql, rows_buf, page_size=500)
        total += len(rows_buf)
        rows_buf.clear()

    cur = conn.cursor() if not dry_run else None

    for chunk in pd.read_csv(path, encoding=ENCODING, chunksize=chunk_size,
                              usecols=["FOLIO", "ID_RAMO", "ID_MODALIDAD", "ID_PP"],
                              dtype=str):
        chunk = chunk.dropna(subset=["FOLIO"])
        for _, row in chunk.iterrows():
            folio = str(row["FOLIO"]).strip()
            if folio not in obra_ids:
                continue
            ramo  = str(row.get("ID_RAMO", "")).strip()
            modal = str(row.get("ID_MODALIDAD", "")).strip()
            pp    = str(row.get("ID_PP", "")).strip()
            fid   = f"RAMO{ramo}-{modal}-{pp}"
            pair  = (f"EF-{folio}", fid)
            if pair in seen:
                continue
            seen.add(pair)
            rows_buf.append(pair)

            if not dry_run and len(rows_buf) >= chunk_size:
                flush(cur)
                conn.commit()

    if not dry_run and rows_buf and cur:
        sql = ("INSERT INTO public.financia (id_obra, id_fuente) VALUES %s "
               "ON CONFLICT (id_obra, id_fuente) DO NOTHING")
        execute_values(cur, sql, rows_buf, page_size=500)
        conn.commit()
        total += len(rows_buf)

    log.info("  %d financia links inserted", total)


# ---------------------------------------------------------------------------
# Step 9 — presupuesto_obra
# ---------------------------------------------------------------------------

def load_presupuestos(conn, dry_run: bool, chunk_size: int,
                      obra_ids: set[str]):
    log.info("Step 8/10 — presupuesto_obra from ef2023.csv …")
    path = os.path.join(DATA_DIR, "ef2023.csv")

    rows_buf: list[tuple] = []
    total = 0

    def flush(cur):
        nonlocal total
        if not rows_buf:
            return
        sql = ("INSERT INTO public.presupuesto_obra "
               "(id_presupuesto, presupuesto_total, id_proyectista, id_obra) "
               "VALUES %s ON CONFLICT (id_obra) DO NOTHING")
        execute_values(cur, sql, rows_buf, page_size=500)
        total += len(rows_buf)
        rows_buf.clear()

    cur = conn.cursor() if not dry_run else None

    for chunk in pd.read_csv(path, encoding=ENCODING, chunksize=chunk_size,
                              usecols=["FOLIO", "MONTO_GLOBAL_APROBADO"],
                              dtype=str):
        chunk = chunk.dropna(subset=["FOLIO"])
        for _, row in chunk.iterrows():
            folio = str(row["FOLIO"]).strip()
            if folio not in obra_ids:
                continue
            monto = safe_float(row.get("MONTO_GLOBAL_APROBADO"), 0.0)
            rows_buf.append((
                f"PRES-{folio}",
                monto,
                SYSTEM_PROYECTISTA["codigo_personal"],
                f"EF-{folio}",
            ))
            if not dry_run and len(rows_buf) >= chunk_size:
                flush(cur)
                conn.commit()
                log.info("    … %d presupuestos inserted so far", total)

    if not dry_run and rows_buf and cur:
        flush(cur)
        conn.commit()

    log.info("  %d presupuesto_obra rows inserted", total)


# ---------------------------------------------------------------------------
# Step 10 — informes (from metas_avances.csv)
# ---------------------------------------------------------------------------

def load_informes(conn, dry_run: bool, chunk_size: int,
                  obra_ids: set[str]):
    log.info("Step 9/10 — informes from metas_avances.csv …")
    path = os.path.join(DATA_DIR, "metas_avances.csv")

    rows_buf: list[tuple] = []
    seen: set[str] = set()
    total = 0
    skipped = 0

    def flush(cur):
        nonlocal total
        if not rows_buf:
            return
        sql = ("INSERT INTO public.informes "
               "(id_informe, ano_infor, mes, porcentaje_avance_fisico, "
               " porcentaje_avance_presupuestario, doc_infome, descripcion, "
               " id_obra, codigo_supervisor) "
               "VALUES %s ON CONFLICT (id_informe) DO NOTHING")
        execute_values(cur, sql, rows_buf, page_size=500)
        total += len(rows_buf)
        rows_buf.clear()

    cur = conn.cursor() if not dry_run else None

    for chunk in pd.read_csv(path, encoding=ENCODING, chunksize=chunk_size,
                              usecols=["FOLIO", "CICLO", "TRIMESTRE",
                                       "AVANCE_FISICO"],
                              dtype=str):
        chunk = chunk.dropna(subset=["FOLIO", "TRIMESTRE"])
        for _, row in chunk.iterrows():
            folio = str(row["FOLIO"]).strip()
            if folio not in obra_ids:
                skipped += 1
                continue

            try:
                trim = int(float(str(row["TRIMESTRE"]).strip()))
                anio = int(float(str(row.get("CICLO", "2023")).strip()))
            except ValueError:
                skipped += 1
                continue

            mes = TRIMESTRE_MES.get(trim, "Diciembre")
            avance = safe_int(row.get("AVANCE_FISICO"), 0)
            iid = f"INF-{folio}-{anio}-T{trim}"

            if iid in seen:
                continue
            seen.add(iid)

            rows_buf.append((
                iid,
                anio,
                mes,
                avance,                          # avance físico
                avance,                          # avance presupuestario (approx)
                f"ef2023_T{trim}_{anio}.csv",   # doc_infome (reference)
                f"Avance T{trim} {anio}: {avance}% físico",
                f"EF-{folio}",
                SYSTEM_SUPERVISOR["codigo_personal"],
            ))

            if not dry_run and len(rows_buf) >= chunk_size:
                flush(cur)
                conn.commit()
                log.info("    … %d informes inserted so far", total)

    if not dry_run and rows_buf and cur:
        flush(cur)
        conn.commit()

    log.info("  %d informes inserted, %d skipped", total, skipped)


# ---------------------------------------------------------------------------
# Step 11 — final verification
# ---------------------------------------------------------------------------

def verify(conn):
    log.info("Step 10/10 — verification …")
    sql = """
        SELECT 'constructoras'      , COUNT(*) FROM public.constructora
        UNION ALL
        SELECT 'regiones'           , COUNT(*) FROM public.region
        UNION ALL
        SELECT 'personal'           , COUNT(*) FROM public.personal
        UNION ALL
        SELECT 'obras'              , COUNT(*) FROM public.obra
        UNION ALL
        SELECT 'fuentes'            , COUNT(*) FROM public.fuente_presupuestaria
        UNION ALL
        SELECT 'financia'           , COUNT(*) FROM public.financia
        UNION ALL
        SELECT 'presupuestos'       , COUNT(*) FROM public.presupuesto_obra
        UNION ALL
        SELECT 'informes'           , COUNT(*) FROM public.informes
        UNION ALL
        SELECT 'dim_obra (DWH)'     , COUNT(*) FROM warehouse.dim_obra
        UNION ALL
        SELECT 'fact_eventos (DWH)' , COUNT(*) FROM warehouse.fact_eventos_auditoria
    """
    with conn.cursor() as cur:
        cur.execute(sql)
        rows = cur.fetchall()

    log.info("  %-25s  %s", "Table", "Rows")
    log.info("  %-25s  %s", "-" * 25, "-" * 10)
    for tabla, count in rows:
        log.info("  %-25s  %d", tabla, count)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="ETL ef2023 → obras_publicas")
    parser.add_argument("--dry-run", action="store_true",
                        help="Parse/transform only; do not write to DB")
    parser.add_argument("--chunk-size", type=int, default=CHUNK_SIZE_DEFAULT,
                        metavar="N")
    args = parser.parse_args()

    dry = args.dry_run
    cs  = args.chunk_size

    if dry:
        log.info("DRY RUN — no data will be written to the database.")

    # Connect
    conn = None
    if not dry:
        log.info("Connecting to database …")
        try:
            conn = psycopg2.connect(**DB)
            conn.autocommit = False
            log.info("Connected.")
        except Exception as e:
            log.error("Cannot connect to database: %s", e)
            sys.exit(1)

    try:
        # Step 1: constructoras (needs contratos.csv)
        rfc_map = load_constructoras(conn, dry, cs)

        # Step 2: system personal
        load_system_personal(conn, dry)

        # Step 3: regions
        region_map = load_regions(conn, dry, cs)

        # Step 4: fuentes presupuestarias
        load_fuentes(conn, dry, cs)

        # Step 5: build folio→rfc index (in-memory, no DB write)
        rfc_by_folio = build_rfc_by_folio(cs)

        # Step 6: obras
        obra_ids = load_obras(conn, dry, cs, region_map, rfc_map, rfc_by_folio)

        # Step 7: financia links
        load_financia(conn, dry, cs, obra_ids)

        # Step 8: presupuesto_obra
        load_presupuestos(conn, dry, cs, obra_ids)

        # Step 9: informes
        load_informes(conn, dry, cs, obra_ids)

        # Step 10: verify
        if not dry and conn:
            verify(conn)

        log.info("ETL completed successfully.")

    except Exception as e:
        log.exception("ETL failed: %s", e)
        if conn:
            conn.rollback()
        sys.exit(1)
    finally:
        if conn:
            conn.close()


if __name__ == "__main__":
    main()
