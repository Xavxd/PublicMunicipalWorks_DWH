"""
backend/app/database.py
================================================================
Capa de conexión — Supabase (PostgreSQL managed)

Supabase expone una cadena de conexión PostgreSQL estándar en:
  Proyecto → Settings → Database → Connection string → URI

La cadena tiene el formato:
  postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres

Se elige el puerto 6543 (Transaction pooler) para entornos sin
estado persistente (serverless / scripts). Si necesitas sesiones
de larga duración usa el puerto 5432 (Session pooler).

Variable de entorno requerida en .env:
  SUPABASE_DB_URL=postgresql://postgres.[ref]:[password]@...
================================================================
"""

import os
import psycopg2
import psycopg2.extras
from contextlib import contextmanager
from dotenv import load_dotenv
from pathlib import Path

# Carga el .env que vive en la raíz del repo (un nivel arriba de backend/)
_env_path = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(dotenv_path=_env_path)


def _get_url() -> str:
    """
    Resuelve la URL de conexión.
    Prioridad: SUPABASE_DB_URL  >  DATABASE_URL  (compatibilidad hacia atrás).
    """
    url = os.getenv("SUPABASE_DB_URL") or os.getenv("DATABASE_URL")
    if not url:
        raise EnvironmentError(
            "No se encontró la variable SUPABASE_DB_URL en el archivo .env. "
            "Cópiala desde Supabase → Settings → Database → Connection string."
        )
    return url


def get_conn():
    """
    Devuelve una conexión psycopg2 cruda con cursor_factory RealDictCursor.
    Útil para el ETL que maneja su propia transacción.
    """
    conn = psycopg2.connect(
        _get_url(),
        cursor_factory=psycopg2.extras.RealDictCursor,
        connect_timeout=10,
    )
    return conn


@contextmanager
def get_db():
    """
    Context manager que entrega (conn, cur) con commit automático
    y rollback en caso de excepción.

    Uso estándar en todos los blueprints:
        with get_db() as (conn, cur):
            cur.execute(...)
    """
    conn = psycopg2.connect(
        _get_url(),
        cursor_factory=psycopg2.extras.RealDictCursor,
        connect_timeout=10,
    )
    try:
        with conn:                        # bloque transaccional automático
            with conn.cursor() as cur:
                yield conn, cur
    finally:
        conn.close()


def test_connection() -> bool:
    """
    Verifica que la BD Supabase sea alcanzable.
    Usada por el health-check de Flask.
    """
    try:
        with get_db() as (_, cur):
            cur.execute("SELECT 1")
        return True
    except Exception as exc:
        print(f"[DB] Supabase no alcanzable: {exc}")
        return False
