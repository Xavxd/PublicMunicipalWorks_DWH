#!/usr/bin/env python3
"""
fix_beneficiarios.py
====================
Corrects the `beneficiarios` column in public.obra.

The original ETL stored POBLACION_BENEFICIADA (a yes/no S/N flag) as the
beneficiarios text. This script re-reads ef2023.csv and updates each obra
with the actual count from BENEFICIARIOS / HOMBRES / MUJERES.
"""

import logging
import psycopg2
from psycopg2.extras import execute_values
import pandas as pd

DATA_DIR = "/home/xavi/PublicMunicipalWorks_DWH/ef2023/cuarto_informe_definitivo"
ENCODING = "latin-1"
CHUNK_SIZE = 10_000

DB = {
    "host":     "localhost",
    "port":     55432,
    "dbname":   "obras_publicas",
    "user":     "obras",
    "password": "obras_local",
}

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s  %(levelname)-8s  %(message)s",
                    datefmt="%H:%M:%S")
log = logging.getLogger("fix_beneficiarios")


def build_beneficiarios(row) -> str:
    ben_total   = str(row.get("BENEFICIARIOS", "")).strip()
    ben_hombres = str(row.get("HOMBRES", "")).strip()
    ben_mujeres = str(row.get("MUJERES", "")).strip()

    if ben_total and ben_total not in ("nan", "N", "S", ""):
        return f"{ben_total} habitantes"[:500]
    elif (ben_hombres and ben_hombres not in ("nan", "")) or \
         (ben_mujeres and ben_mujeres not in ("nan", "")):
        h = ben_hombres if ben_hombres not in ("nan", "") else "0"
        m = ben_mujeres if ben_mujeres not in ("nan", "") else "0"
        return f"{h} hombres, {m} mujeres"[:500]
    return "No especificado"


def main():
    log.info("Connecting …")
    conn = psycopg2.connect(**DB)
    conn.autocommit = False

    path = f"{DATA_DIR}/ef2023.csv"
    rows_buf = []
    total = 0

    def flush(cur):
        nonlocal total
        if not rows_buf:
            return
        execute_values(
            cur,
            "UPDATE public.obra AS o SET beneficiarios = v.ben "
            "FROM (VALUES %s) AS v(folio, ben) "
            "WHERE o.codigo_expediente = v.folio",
            rows_buf,
            page_size=500,
        )
        total += len(rows_buf)
        rows_buf.clear()

    log.info("Reading ef2023.csv and updating beneficiarios …")
    seen = set()

    with conn.cursor() as cur:
        for chunk in pd.read_csv(
            path, encoding=ENCODING, chunksize=CHUNK_SIZE,
            usecols=["FOLIO", "BENEFICIARIOS", "HOMBRES", "MUJERES"],
            dtype=str,
        ):
            chunk = chunk.dropna(subset=["FOLIO"])
            for _, row in chunk.iterrows():
                folio = str(row["FOLIO"]).strip()
                if folio in seen:
                    continue
                seen.add(folio)
                rows_buf.append((folio, build_beneficiarios(row)))

                if len(rows_buf) >= CHUNK_SIZE:
                    flush(cur)
                    conn.commit()
                    log.info("  … %d rows updated", total)

        flush(cur)
        conn.commit()

    log.info("Done — %d obra rows updated.", total)

    # Verify
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM public.obra WHERE beneficiarios IN ('S','N','No especificado')")
        remaining = cur.fetchone()[0]
        log.info("Rows still with flag value: %d", remaining)

    conn.close()


if __name__ == "__main__":
    main()
