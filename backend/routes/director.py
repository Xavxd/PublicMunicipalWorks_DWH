from flask import Blueprint, request
from app.database import get_db
from app.helpers import (
    ok, created, bad_request, not_found,
    db_error_response, require_fields,
)
from app.middleware.auth import require_auth

director_bp = Blueprint("director", __name__)



def _gen_constructora_id(cur) -> str:
    """
    Tabla: public.constructora
    Columna: id_constructora  CHAR(10)
    Formato: CONS000001 … CONS999999
    """
    cur.execute(
        "SELECT id_constructora FROM public.constructora ORDER BY id_constructora DESC LIMIT 1"
    )
    row = cur.fetchone()
    if not row:
        num = 1
    else:
        last = (row["id_constructora"] or "CONS000000").strip()
        try:
            num = int(last[4:]) + 1        # 'CONS000003' → 3 → 4
        except ValueError:
            cur.execute("SELECT COUNT(*) AS n FROM public.constructora")
            num = cur.fetchone()["n"] + 1
    return f"CONS{num:06d}"               # 'CONS000004' — 10 chars


def _gen_region_id(cur) -> str:
    """
    Tabla: public.region
    Columna: id_region  CHAR(5)
    Formato: R001 … R999 (con un espacio de padding para CHAR(5))
    """
    cur.execute(
        "SELECT id_region FROM public.region ORDER BY id_region DESC LIMIT 1"
    )
    row = cur.fetchone()
    if not row:
        num = 1
    else:
        last = (row["id_region"] or "R000").strip()
        try:
            num = int(last[1:]) + 1        # 'R004' → 4 → 5
        except ValueError:
            cur.execute("SELECT COUNT(*) AS n FROM public.region")
            num = cur.fetchone()["n"] + 1
    raw = f"R{num:03d}"                   # 'R005' — 4 chars → CHAR(5) se llena solo
    return raw                            # psycopg2 + Postgres hace el padding de CHAR


def _gen_obra_id(cur) -> str:
    """
    Tabla: public.obra
    Columna: id_obra  CHAR(20)
    Formato: OBRA000000000000001 … (longitud total 20)
    """
    cur.execute(
        "SELECT id_obra FROM public.obra ORDER BY id_obra DESC LIMIT 1"
    )
    row = cur.fetchone()
    if not row:
        num = 1
    else:
        last = (row["id_obra"] or "OBRA" + "0" * 16).strip()
        try:
            num = int(last[4:]) + 1       # 'OBRA000000000000001' → 1 → 2
        except ValueError:
            cur.execute("SELECT COUNT(*) AS n FROM public.obra")
            num = cur.fetchone()["n"] + 1
    return f"OBRA{num:016d}"              # 20 chars en total


def _gen_presupuesto_id(cur) -> str:
    """
    Tabla: public.presupuesto_obra
    Columna: id_presupuesto  CHAR(10)
    Formato: PRES000001 … PRES999999
    """
    cur.execute(
        "SELECT id_presupuesto FROM public.presupuesto_obra ORDER BY id_presupuesto DESC LIMIT 1"
    )
    row = cur.fetchone()
    if not row:
        num = 1
    else:
        last = (row["id_presupuesto"] or "PRES000000").strip()
        try:
            num = int(last[4:]) + 1
        except ValueError:
            cur.execute("SELECT COUNT(*) AS n FROM public.presupuesto_obra")
            num = cur.fetchone()["n"] + 1
    return f"PRES{num:06d}"              # 10 chars


# ════════════════════════════════════════════════════════════════
#  CONSTRUCTORAS
# ════════════════════════════════════════════════════════════════

@director_bp.route("/api/constructoras", methods=["GET"])
@require_auth("director", "supervisor", "proyectista", "secretaria")
def get_constructoras(current_user):
    """
    Catálogo completo de constructoras.
    Usado por el panel 'Constructoras' y el select de búsqueda.
    Respuesta item:
      { id, nombre, rfc, tipo }
    """
    try:
        with get_db() as (conn, cur):
            cur.execute("""
                SELECT
                    TRIM(id_constructora) AS id,
                    TRIM(nombre_const)    AS nombre,
                    TRIM(rfc)             AS rfc,
                    TRIM(tipo_ejecutor)   AS tipo
                FROM public.constructora
                ORDER BY nombre_const ASC
            """)
            rows = [dict(r) for r in cur.fetchall()]
        return ok(rows)
    except Exception as exc:
        return db_error_response(exc)


@director_bp.route("/api/constructoras", methods=["POST"])
@require_auth("director")
def create_constructora(current_user):
    """
    PASO 1 del wizard.

    Body esperado (coincide con lo que envía director.js):
    {
      "nombre":       "Constructora Vías del Sur S.A. de C.V.",
      "rfc":          "CVS020415T34",
      "tipoEjecutor": "Empresa Externa"
    }

    Respuesta exitosa:
    {
      "success": true,
      "data":    { "id": "CONS000005", "nombre": "...", "rfc": "..." },
      "message": "Constructora registrada: CONS000005"
    }

    Regla anti-duplicado:
      Si el RFC ya existe, devuelve el registro existente con
      "reused": true.  El wizard continúa con ese ID sin crear ruido.

    SQL que se ejecuta:
      INSERT INTO public.constructora
        (id_constructora, nombre_const, rfc, tipo_ejecutor)
      VALUES ($1, $2, $3, $4)
    """
    body = request.get_json(silent=True) or {}

    # El JS manda "tipoEjecutor", normalizamos aquí
    valid, err = require_fields(body, "nombre", "rfc", "tipoEjecutor")
    if not valid:
        return bad_request("ESTO ES UNA PRUEBA DE URI")

    nombre = body["nombre"].strip()
    rfc    = body["rfc"].strip().upper()
    tipo   = body["tipoEjecutor"].strip()

    # Validación mínima de RFC mexicano (3–4 letras + 6 dígitos + 3 alfanuméricos)
    import re
    if not re.match(r'^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$', rfc, re.IGNORECASE):
        return bad_request(
            "El RFC no tiene un formato válido. Ejemplo correcto: CVS020415T34"
        )

    try:
        with get_db() as (conn, cur):

            # ── Verificar RFC duplicado ───────────────────────────
            cur.execute(
                "SELECT TRIM(id_constructora) AS id FROM public.constructora WHERE TRIM(rfc) = %s",
                (rfc,)
            )
            existing = cur.fetchone()
            if existing:
                return ok(
                    {
                        "id":     existing["id"],
                        "nombre": nombre,
                        "rfc":    rfc,
                        "reused": True,
                    },
                    f"RFC ya registrado. Reutilizando constructora {existing['id']}."
                )

            # ── Generar ID y registrar ────────────────────────────
            new_id = _gen_constructora_id(cur)

            cur.execute("""
                INSERT INTO public.constructora
                    (id_constructora, nombre_const, rfc, tipo_ejecutor)
                VALUES (%s, %s, %s, %s)
            """, (new_id, nombre[:150], rfc, tipo[:100]))

        return created(
            {"id": new_id, "nombre": nombre, "rfc": rfc},
            f"Constructora registrada: {new_id}"
        )

    except Exception as exc:
        return db_error_response(exc)


# ════════════════════════════════════════════════════════════════
#  REGIONES
# ════════════════════════════════════════════════════════════════

@director_bp.route("/api/regiones", methods=["GET"])
@require_auth("director", "supervisor", "proyectista", "secretaria")
def get_regiones(current_user):
    """
    Lista todas las regiones.  Útil para búsquedas o autocompletado.
    """
    try:
        with get_db() as (conn, cur):
            cur.execute("""
                SELECT
                    TRIM(id_region) AS id,
                    TRIM(comunidad) AS comunidad,
                    TRIM(barrio)    AS barrio,
                    colonia
                FROM public.region
                ORDER BY comunidad, barrio
            """)
            rows = [dict(r) for r in cur.fetchall()]
        return ok(rows)
    except Exception as exc:
        return db_error_response(exc)


@director_bp.route("/api/regiones", methods=["POST"])
@require_auth("director")
def create_region(current_user):
    """
    PASO 2 del wizard.

    Body esperado (coincide con lo que envía director.js):
    {
      "comunidad": "Albarranes",
      "barrio":    "Barrio Temeroso",
      "colonia":   "Col. Centro"      ← puede ser null / ausente
    }

    Respuesta exitosa:
    {
      "success": true,
      "data":    { "id": "R005", "comunidad": "Albarranes", "barrio": "Barrio Temeroso" },
      "message": "Región registrada: R005"
    }

    Regla anti-duplicado:
      Si ya existe la misma combinación comunidad+barrio, se devuelve
      el ID existente con "reused": true.

    SQL que se ejecuta:
      INSERT INTO public.region
        (id_region, comunidad, barrio, colonia)
      VALUES ($1, $2, $3, $4)
    """
    body = request.get_json(silent=True) or {}
    valid, err = require_fields(body, "comunidad", "barrio")
    if not valid:
        return err

    comunidad = body["comunidad"].strip()[:50]
    barrio    = body["barrio"].strip()[:150]
    colonia   = (body.get("colonia") or "").strip() or None

    try:
        with get_db() as (conn, cur):

            # ── Verificar duplicado por comunidad + barrio ────────
            cur.execute("""
                SELECT TRIM(id_region) AS id
                FROM public.region
                WHERE TRIM(LOWER(comunidad)) = LOWER(%s)
                  AND TRIM(LOWER(barrio))    = LOWER(%s)
                LIMIT 1
            """, (comunidad, barrio))
            existing = cur.fetchone()
            if existing:
                return ok(
                    {
                        "id":       existing["id"],
                        "comunidad": comunidad,
                        "barrio":   barrio,
                        "reused":   True,
                    },
                    f"Región ya existente. Reutilizando {existing['id']}."
                )

            # ── Generar ID y registrar ────────────────────────────
            new_id = _gen_region_id(cur)

            cur.execute("""
                INSERT INTO public.region
                    (id_region, comunidad, barrio, colonia)
                VALUES (%s, %s, %s, %s)
            """, (new_id, comunidad, barrio, colonia))

        return created(
            {"id": new_id, "comunidad": comunidad, "barrio": barrio},
            f"Región registrada: {new_id}"
        )

    except Exception as exc:
        return db_error_response(exc)


# ════════════════════════════════════════════════════════════════
#  OBRAS
# ════════════════════════════════════════════════════════════════

@director_bp.route("/api/obras", methods=["GET"])
@require_auth("director", "supervisor", "proyectista", "secretaria")
def get_obras(current_user):
    """
    Lista obras con joins a constructora y región.
    Acepta ?q=<texto> para filtrar por nombre o expediente.

    Respuesta item (usada por renderObrasTable en director.js):
    {
      "id":                "OBRA0000...",
      "expediente":        "EXP-2026-001",
      "nombre":            "Pavimento Hidráulico...",
      "regionComunidad":   "Albarranes",
      "regionBarrio":      "Barrio Temeroso",
      "constructoraNombre":"Constructora Vías...",
      "constructoraTipo":  "Empresa Externa",
      "fechaInicio":       "2026-03-01",
      "fechaFin":          "2026-09-30",
      "status":            "activa"
    }
    """
    q = request.args.get("q", "").strip()

    try:
        with get_db() as (conn, cur):
            cur.execute("""
                SELECT
                    TRIM(o.id_obra)           AS id,
                    TRIM(o.codigo_expediente) AS expediente,
                    TRIM(o.nombre_obra)       AS nombre,
                    TRIM(r.comunidad)         AS "regionComunidad",
                    TRIM(r.barrio)            AS "regionBarrio",
                    TRIM(c.nombre_const)      AS "constructoraNombre",
                    TRIM(c.tipo_ejecutor)     AS "constructoraTipo",
                    o.fecha_inicio            AS "fechaInicio",
                    o.fecha_final             AS "fechaFin",
                    COALESCE(o.status, 'activa') AS status
                FROM public.obra o
                LEFT JOIN public.constructora c
                    ON TRIM(c.id_constructora) = TRIM(o.id_constructora)
                LEFT JOIN public.region r
                    ON TRIM(r.id_region) = TRIM(o.id_region)
                WHERE
                    %s = ''
                    OR TRIM(o.nombre_obra)       ILIKE %s
                    OR TRIM(o.codigo_expediente) ILIKE %s
                ORDER BY o.fecha_inicio DESC NULLS LAST
            """, (q, f"%{q}%", f"%{q}%"))
            rows = [dict(r) for r in cur.fetchall()]
        return ok(rows)
    except Exception as exc:
        return db_error_response(exc)


@director_bp.route("/api/obras", methods=["POST"])
@require_auth("director")
def create_obra(current_user):
    """
    PASO 3 del wizard — llamado por submitObra() en director.js.

    Body esperado (ver director.js líneas 296–308):
    {
      "constructoraId":  "CONS000005",       ← del wizardState
      "regionId":        "R005",              ← del wizardState
      "supervisorId":    "SUP...",            ← select del paso 3
      "nombre":          "Pavimento Hidráulico...",
      "etapa":           1,
      "fechaInicio":     "2026-03-01",
      "fechaFin":        "2026-09-30",
      "descripcion":     "...",
      "beneficiarios":   "450 habitantes...",
      "presupuesto":     1250000.00,
      "fuentes":         ["FP0000001", "FP0000003"]
    }

    Operaciones en orden (transacción única):
      1. Verifica existencia de constructora, región y supervisor.
      2. Genera codigo_expediente automático (EXP-YYYY-NNN).
      3. INSERT public.obra
      4. INSERT public.presupuesto_obra
      5. INSERT public.financia  (una fila por fuente seleccionada)

    Respuesta:
    {
      "success":    true,
      "data":       { "id": "OBRA0000...", "expediente": "EXP-2026-005", "nombre": "..." },
      "message":    "Obra registrada exitosamente."
    }
    """
    body = request.get_json(silent=True) or {}

    valid, err = require_fields(
        body,
        "constructoraId", "regionId", "supervisorId",
        "nombre", "fechaInicio", "fechaFin", "beneficiarios"
    )
    if not valid:
        return err

    # Extraer y limpiar campos
    constructora_id = body["constructoraId"].strip()
    region_id       = body["regionId"].strip()
    supervisor_id   = body["supervisorId"].strip()
    nombre          = body["nombre"].strip()[:200]
    etapa           = int(body.get("etapa") or 1)
    fecha_inicio    = body["fechaInicio"]
    fecha_fin       = body["fechaFin"]
    descripcion     = (body.get("descripcion") or "Sin descripción.").strip()[:500]
    beneficiarios   = body["beneficiarios"].strip()[:500]
    presupuesto     = float(body.get("presupuesto") or 0)
    fuentes         = body.get("fuentes") or []   # lista de IDs de fuentes

    # Validar rango de fechas
    if fecha_inicio >= fecha_fin:
        return bad_request(
            "La fecha de finalización debe ser posterior a la de inicio."
        )

    try:
        with get_db() as (conn, cur):

            # ── 1. Verificar entidades relacionadas ───────────────

            cur.execute(
                "SELECT 1 FROM public.constructora WHERE TRIM(id_constructora) = %s",
                (constructora_id,)
            )
            if not cur.fetchone():
                return bad_request(
                    f"La constructora '{constructora_id}' no existe en la base de datos. "
                    "Completa el Paso 1 antes de continuar."
                )

            cur.execute(
                "SELECT 1 FROM public.region WHERE TRIM(id_region) = %s",
                (region_id,)
            )
            if not cur.fetchone():
                return bad_request(
                    f"La región '{region_id}' no existe en la base de datos. "
                    "Completa el Paso 2 antes de continuar."
                )

            cur.execute(
                "SELECT 1 FROM public.supervisor WHERE TRIM(codigo_personal) = %s",
                (supervisor_id,)
            )
            if not cur.fetchone():
                return bad_request(
                    f"El supervisor '{supervisor_id}' no está registrado en el sistema."
                )

            # ── 2. Generar código de expediente ───────────────────
            # Formato: EXP-YYYY-NNN  (NNN = total de obras + 1)
            from datetime import date
            anio = date.today().year
            cur.execute("SELECT COUNT(*) AS n FROM public.obra")
            total = cur.fetchone()["n"]
            expediente = f"EXP-{anio}-{total + 1:03d}"

            # ── 3. Generar ID de obra ─────────────────────────────
            obra_id = _gen_obra_id(cur)

            # ── 4. INSERT obra ────────────────────────────────────
            cur.execute("""
                INSERT INTO public.obra (
                    id_obra,
                    codigo_expediente,
                    nombre_obra,
                    etapa,
                    fecha_inicio,
                    fecha_final,
                    descripcion,
                    beneficiarios,
                    id_constructora,
                    id_region,
                    codigo_supervisor
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                obra_id,
                expediente,
                nombre,
                etapa,
                fecha_inicio,
                fecha_fin,
                descripcion,
                beneficiarios,
                constructora_id,
                region_id,
                supervisor_id,
            ))

            # ── 5. INSERT presupuesto_obra ────────────────────────
            # Busca el primer proyectista disponible para asociar el
            # presupuesto inicial.  El director asignará uno formalmente
            # después (flujo del proyectista).
            cur.execute("""
                SELECT TRIM(codigo_personal) AS id
                FROM public.proyectista
                ORDER BY codigo_personal
                LIMIT 1
            """)
            proy_row = cur.fetchone()
            proy_id  = proy_row["id"] if proy_row else None

            if proy_id:
                pres_id = _gen_presupuesto_id(cur)
                cur.execute("""
                    INSERT INTO public.presupuesto_obra
                        (id_presupuesto, presupuesto_total, id_proyectista, id_obra)
                    VALUES (%s, %s, %s, %s)
                """, (pres_id, presupuesto, proy_id, obra_id))

            # ── 6. INSERT financia (una fila por fuente) ──────────
            for fuente_id in fuentes:
                fuente_id = fuente_id.strip()
                if not fuente_id:
                    continue
                # Verificar que la fuente existe antes de insertar
                cur.execute(
                    "SELECT 1 FROM public.fuente_presupuestaria WHERE TRIM(id_fuente) = %s",
                    (fuente_id,)
                )
                if cur.fetchone():
                    cur.execute("""
                        INSERT INTO public.financia (id_obra, id_fuente)
                        VALUES (%s, %s)
                        ON CONFLICT DO NOTHING
                    """, (obra_id, fuente_id))

        return created(
            {
                "id":         obra_id,
                "expediente": expediente,
                "nombre":     nombre,
            },
            "Obra registrada exitosamente."
        )

    except Exception as exc:
        return db_error_response(exc)


@director_bp.route("/api/obras/<obra_id>", methods=["GET"])
@require_auth("director", "supervisor", "proyectista", "secretaria")
def get_obra(obra_id, current_user):
    """Detalle completo de una obra con sus fuentes."""
    try:
        with get_db() as (conn, cur):
            cur.execute("""
                SELECT
                    TRIM(o.id_obra)           AS id,
                    TRIM(o.codigo_expediente) AS expediente,
                    TRIM(o.nombre_obra)       AS nombre,
                    o.etapa,
                    o.fecha_inicio            AS "fechaInicio",
                    o.fecha_final             AS "fechaFin",
                    TRIM(o.descripcion)       AS descripcion,
                    TRIM(o.beneficiarios)     AS beneficiarios,
                    TRIM(o.id_constructora)   AS "constructoraId",
                    TRIM(c.nombre_const)      AS "constructoraNombre",
                    TRIM(o.id_region)         AS "regionId",
                    TRIM(r.comunidad)         AS "regionComunidad",
                    TRIM(r.barrio)            AS "regionBarrio",
                    TRIM(o.codigo_supervisor) AS "supervisorId",
                    COALESCE(po.presupuesto_total, 0) AS presupuesto,
                    COALESCE(o.status, 'activa')      AS status
                FROM public.obra o
                LEFT JOIN public.constructora c
                    ON TRIM(c.id_constructora) = TRIM(o.id_constructora)
                LEFT JOIN public.region r
                    ON TRIM(r.id_region) = TRIM(o.id_region)
                LEFT JOIN public.presupuesto_obra po
                    ON TRIM(po.id_obra) = TRIM(o.id_obra)
                WHERE TRIM(o.id_obra) = %s
                LIMIT 1
            """, (obra_id.strip(),))
            obra = cur.fetchone()

            if not obra:
                return not_found("Obra no encontrada.")

            # Fuentes vinculadas
            cur.execute("""
                SELECT
                    TRIM(f.id_fuente)          AS id,
                    TRIM(fp.grado_nivel)       AS nivel,
                    fp.programa
                FROM public.financia f
                JOIN public.fuente_presupuestaria fp
                    ON TRIM(fp.id_fuente) = TRIM(f.id_fuente)
                WHERE TRIM(f.id_obra) = %s
            """, (obra_id.strip(),))
            fuentes = [dict(r) for r in cur.fetchall()]

        result = dict(obra)
        result["fuentes"] = fuentes
        return ok(result)

    except Exception as exc:
        return db_error_response(exc)


@director_bp.route("/api/obras/<obra_id>", methods=["DELETE"])
@require_auth("director")
def delete_obra(obra_id, current_user):
    """
    Elimina una obra y todas sus dependencias (presupuesto, financia).
    Llamado por deleteObraConfirm() en director.js.
    """
    try:
        with get_db() as (conn, cur):

            # Verificar existencia
            cur.execute(
                "SELECT TRIM(nombre_obra) AS nombre FROM public.obra WHERE TRIM(id_obra) = %s",
                (obra_id.strip(),)
            )
            row = cur.fetchone()
            if not row:
                return not_found(f"La obra '{obra_id}' no existe.")

            nombre = row["nombre"]

            # Eliminar dependencias en orden (FK)
            cur.execute(
                "DELETE FROM public.financia WHERE TRIM(id_obra) = %s",
                (obra_id.strip(),)
            )
            cur.execute(
                "DELETE FROM public.presupuesto_obra WHERE TRIM(id_obra) = %s",
                (obra_id.strip(),)
            )
            cur.execute(
                "DELETE FROM public.obra WHERE TRIM(id_obra) = %s",
                (obra_id.strip(),)
            )

        return ok(message=f"Obra '{nombre}' eliminada correctamente.")

    except Exception as exc:
        return db_error_response(exc)


# ════════════════════════════════════════════════════════════════
#  SUPERVISORES  (select del Paso 3)
# ════════════════════════════════════════════════════════════════

@director_bp.route("/api/supervisores", methods=["GET"])
@require_auth("director", "secretaria")
def get_supervisores(current_user):
    """
    Listado de supervisores para poblar el <select> del Paso 3.
    El JS espera: { id, nombre, apellidoPaterno }
    Ver director.js línea 213–215.
    """
    try:
        with get_db() as (conn, cur):
            cur.execute("""
                SELECT
                    TRIM(s.codigo_personal)       AS id,
                    TRIM(p.nombre)                AS nombre,
                    TRIM(p.apellido_paterno)      AS "apellidoPaterno"
                FROM public.supervisor s
                JOIN public.personal p
                    ON TRIM(p.codigo_personal) = TRIM(s.codigo_personal)
                ORDER BY p.nombre, p.apellido_paterno
            """)
            rows = [dict(r) for r in cur.fetchall()]
        return ok(rows)
    except Exception as exc:
        return db_error_response(exc)


# ════════════════════════════════════════════════════════════════
#  FUENTES PRESUPUESTARIAS
# ════════════════════════════════════════════════════════════════

@director_bp.route("/api/fuentes", methods=["GET"])
@require_auth("director", "supervisor", "proyectista", "secretaria")
def get_fuentes(current_user):
    """
    Catálogo de fuentes presupuestarias.
    El JS espera: { id, nivel, programa }
    Ver director.js línea 227–234 (nivelClass) y línea 461.
    El campo 'nivel' debe ser FEDERAL | ESTATAL | MUNICIPAL
    (en mayúsculas tal como lo usa el JS para el CSS class).
    """
    try:
        with get_db() as (conn, cur):
            cur.execute("""
                SELECT
                    TRIM(id_fuente)              AS id,
                    UPPER(TRIM(grado_nivel))     AS nivel,
                    programa
                FROM public.fuente_presupuestaria
                ORDER BY grado_nivel, programa
            """)
            rows = [dict(r) for r in cur.fetchall()]
        return ok(rows)
    except Exception as exc:
        return db_error_response(exc)


# ════════════════════════════════════════════════════════════════
#  CONCURSOS DE SELECCIÓN
#  Sólo se pueden registrar si la obra ya existe.
#  El alta la gestiona Secretaría; el director consulta.
# ════════════════════════════════════════════════════════════════

@director_bp.route("/api/concursos", methods=["GET"])
@require_auth("director", "supervisor", "secretaria")
def get_concursos(current_user):
    """Lista concursos, opcionalmente filtrados por ?obra=<id_obra>."""
    obra_filter = request.args.get("obra")
    try:
        with get_db() as (conn, cur):
            cur.execute("""
                SELECT
                    TRIM(s.id_participante)    AS id,
                    TRIM(s.id_obra)            AS "obraId",
                    TRIM(o.nombre_obra)        AS "obraNombre",
                    TRIM(s.constructora)       AS constructora,
                    s.aprobado,
                    s.razones_decision         AS razones
                FROM public.opcion_seleccion s
                JOIN public.obra o
                    ON TRIM(o.id_obra) = TRIM(s.id_obra)
                WHERE (%s IS NULL OR TRIM(s.id_obra) = %s)
                ORDER BY s.id_participante DESC
            """, (obra_filter, obra_filter))
            rows = [dict(r) for r in cur.fetchall()]
        return ok(rows)
    except Exception as exc:
        return db_error_response(exc)
