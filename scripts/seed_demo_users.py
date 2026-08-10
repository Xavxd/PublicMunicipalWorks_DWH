"""
Seed of the read-only demonstration accounts documented in the README.
=============================================================================

Why this script exists
----------------------
Before it, the README documented login credentials that existed nowhere:

  * `public.personal` (director, supervisor, proyectista, secretario) was
    never populated. `scripts/generate_synthetic_data.py` fills
    `warehouse.dim_personal`, which is the *dimension*, not the table that
    `POST /api/auth/login` queries.
  * The citizens inserted by that script carried a hardcoded literal in the
    bcrypt format (`$2b$12$...`), while `app/password_security.py` verifies
    with Werkzeug's `check_password_hash`, i.e. PBKDF2-SHA256. A bcrypt
    string cannot be verified by that function, so those logins could never
    succeed either.

This script creates the four staff accounts documented in the README, with
hashes generated at run time by the same function the application uses. No
hash is hardcoded here — that was the original defect.

Read-only by construction
-------------------------
`codigo_personal` uses the `DEMO-` prefix. `routes/decorators.py` reads that
prefix from the `X-User-Id` header and rejects every POST/PUT/PATCH/DELETE
with HTTP 403 before the handler runs. These accounts can therefore be
published without exposing the demo instance to writes.

Usage
-----
    export DATABASE_URL="postgresql://user:pass@host:5432/dbname"
    python scripts/seed_demo_users.py

Re-running is safe: existing rows are updated, not duplicated.
"""
import os
import sys

try:
    import psycopg2
except ImportError:
    sys.exit("psycopg2 is required:  pip install psycopg2-binary")

from werkzeug.security import generate_password_hash

# ---------------------------------------------------------------------------
#  The single set of demonstration credentials documented in the README.
#  Roles must match the strings accepted by @require_auth in routes/:
#  director | supervisor | proyectista | secretario
# ---------------------------------------------------------------------------
DEMO_USERS = [
    # codigo_personal, nombre,   ap_paterno,  ap_materno, username,      rol,           password
    ("DEMO-DIR-001", "Demo", "Director",    "ICOKG", "demo_director",    "director",    "Icokg2026-Dir"),
    ("DEMO-SUP-001", "Demo", "Supervisor",  "ICOKG", "demo_supervisor",  "supervisor",  "Icokg2026-Sup"),
    ("DEMO-PRY-001", "Demo", "Proyectista", "ICOKG", "demo_proyectista", "proyectista", "Icokg2026-Pry"),
    ("DEMO-SEC-001", "Demo", "Secretario",  "ICOKG", "demo_secretario",  "secretario",  "Icokg2026-Sec"),
]

UPSERT = """
INSERT INTO public.personal
    (codigo_personal, nombre, apellido_paterno, apellido_materno,
     username, password_hash, rol)
VALUES (%s, %s, %s, %s, %s, %s, %s)
ON CONFLICT (codigo_personal) DO UPDATE SET
    username      = EXCLUDED.username,
    password_hash = EXCLUDED.password_hash,
    rol           = EXCLUDED.rol;
"""


def main():
    dsn = os.getenv("DATABASE_URL")
    if not dsn:
        sys.exit("DATABASE_URL is not set. Refusing to guess a connection string.")

    conn = psycopg2.connect(dsn)
    cur = conn.cursor()

    for codigo, nombre, ap_pat, ap_mat, username, rol, password in DEMO_USERS:
        # Same hashing path as app/password_security.py: PBKDF2-SHA256,
        # random 16-byte salt. Generated here, never stored in the repo.
        pwd_hash = generate_password_hash(password, method="pbkdf2:sha256", salt_length=16)
        cur.execute(UPSERT, (codigo, nombre, ap_pat, ap_mat, username, pwd_hash, rol))
        print(f"  {username:18s} rol={rol:12s} id={codigo}")

    conn.commit()
    cur.close()
    conn.close()

    print(f"\n{len(DEMO_USERS)} demonstration accounts seeded (read-only: DEMO- prefix).")
    print("Passwords are the ones documented in the README.")


if __name__ == "__main__":
    main()
