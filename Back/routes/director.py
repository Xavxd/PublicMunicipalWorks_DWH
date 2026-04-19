"""
backend/app/routes/director.py
================================================================
MÓDULO: DIRECTOR DE OBRAS
Registro modular y progresivo:
  Paso 1 — Constructora       → POST /api/constructoras
  Paso 2 — Región             → POST /api/regiones
  Paso 3 — Obra               → POST /api/obras  (consume FKs anteriores)
  Paso 4 — Fuentes            → POST /api/obras/<id>/fuentes
  Consultas  → GET /api/obras | /api/constructoras | /api/regiones | /api/fuentes | /api/concursos
  Eliminación → DELETE /api/obras/<id>

Sin cambios de lógica — solo actualización de ruta de imports.
================================================================
"""

from flask import Blueprint, request
from app.database import get_db
from app.helpers import (
    ok, created, bad_request, not_found,
    db_error_response, require_fields,
)
from app.middleware.auth import require_auth
import re

director_bp = Blueprint("director", __name__)


# ================================================================
#  GENERACIÓN DE IDs
# ================================================================

def _next_id_constructora(cur):
    cur.execute("""
        SELECT COALESCE(
            MAX(CAST(TRIM(SUBSTRING(id_constructora FROM 5)) AS INTEGER)), 0
        ) + 1
        FROM public.constructora
        WHERE id_constructora ~ '^CONS[0-9]+\\s*$'
    """)
    return f"CONS{cur.fetchone()[0]:06d}"


def _next_id_region(cur):
    cur.execute("""
        SELECT COALESCE(
            MAX(CAST(TRIM(SUBSTRING(id_region FROM 2)) AS INTEGER)), 0
        ) + 1
        FROM public.region
        WHERE id_region ~ '^R[0-9]+\\s*$'
    """)
    return f"R{cur.fetchone()[0]:03d}"


def _next_id_obra(cur):
    cur.execute("""
        SELECT COALESCE(
            MAX(CAST(TRIM(SUBSTRING(id_obra FROM 5)) AS BIGINT)), 0
        ) + 1
        FROM public.obra
        WHERE id_obra ~ '^OBRA[0-9]+\\s*$'
    """)
    return f"OBRA{cur.fetchone()[0]:015d}".ljust(20)


def _next_expediente(cur, anio):
    cur.execute("""
        SELECT COALESCE(MAX(
            CAST(TRIM(SPLIT_PART(codigo_expediente, '-', 3)) AS INTEGER)
        ), 0) + 1
        FROM public.obra
        WHERE codigo_expediente LIKE %s
          AND codigo_expediente ~ '^EXP-[0-9]{4}-[0-9]+'
    """, (f"EXP-{anio}-%",))
    return f"EXP-{anio}-{cur.fetchone()[0]:03d}"


def _next_id_presupuesto(cur):
    cur.execute("""
        SELECT COALESCE(
            MAX(CAST(TRIM(SUBSTRING(id_presupuesto FROM 5)) AS INTEGER)), 0
        ) + 1
        FROM public.presupuesto_obra
        WHERE id_presupuesto ~ '^PRES[0-9]+\\s*$'
    """)
    return f"PRES{cur.fetchone()[0]:06d}"


# ================================================================
#  CONSTRUCTORAS
# ================================================================

@director_bp.route("/api/constructoras", methods=["GET"])
@require_auth("director", "supervisor", "proyectista", "secretaria")
def get_constructoras(current_user):
    try:
        with get_db() as (_, cur):
            cur.execute("""
                SELECT
                    TRIM(id_constructora) AS "id",
                    TRIM(nombre_const)    AS "nombre",
                    TRIM(rfc)             AS "rfc",
                    TRIM(tipo_ejecutor)   AS "tipo"
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
    PASO 1 del wizard. Registra la constructora ejecutora.
    Body: { "nombre", "rfc", "tipoEjecutor" }
    """
    body = request.get_json(silent=True) or {}
    valid, err = require_fields(body, "nombre", "rfc", "tipoEjecutor")
    if not valid:
        return err

    rfc_clean = body["rfc"].strip().upper()
    if not re.match(r'^[A-Z&]{3,4}[0-9]{6}[A-Z0-9]{3}$', rfc_clean):
        return bad_request(
            "El RFC no tiene el formato válido (ej. CVS020415T34)."
        )

    try:
        with get_db() as (_, cur):
            cur.execute(
                "SELECT TRIM(id_constructora) FROM public.constructora WHERE TRIM(rfc) = %s",
                (rfc_clean,)
            )
            existing = cur.fetchone()
            if existing:
                return bad_request(
                    f"RFC {rfc_clean} ya registrado. "
                    f"ID existente: {list(existing.values())[0]}"
                )

            new_id = _next_id_constructora(cur)
            cur.execute("""
                INSERT INTO public.constructora
                    (id_constructora, rfc, nombre_const, tipo_ejecutor)
                VALUES (%s, %s, %s, %s)
            """, (
                new_id,
                rfc_clean.ljust(12),
                body["nombre"][:150].ljust(150),
                body["tipoEjecutor"][:100].ljust(100),
            ))

        return created(
            {"id": new_id, "nombre": body["nombre"]},
            f"Constructora '{body['nombre']}' registrada con ID {new_id}."
        )
    except Exception as exc:
        return db_error_response(exc)


# ================================================================
#  REGIONES
# ================================================================

@director_bp.route("/api/regiones", methods=["GET"])
@require_auth("director", "supervisor", "proyectista", "secretaria")
def get_regiones(current_user):
    try:
        with get_db() as (_, cur):
            cur.execute("""
                SELECT
                    TRIM(id_region) AS "id",
                    TRIM(comunidad) AS "comunidad",
                    TRIM(barrio)    AS "barrio",
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
    PASO 2 del wizard. Registra la región donde se ejecuta la obra.
    Body: { "comunidad", "barrio", "colonia"? }
    """
    body = request.get_json(silent=True) or {}
    valid, err = require_fields(body, "comunidad", "barrio")
    if not valid:
        return err

    try:
        with get_db() as (_, cur):
            new_id = _next_id_region(cur)
            cur.execute("""
                INSERT INTO public.region (id_region, comunidad, barrio, colonia)
                VALUES (%s, %s, %s, %s)
            """, (
                new_id.ljust(5),
                body["comunidad"][:50],
                body["barrio"][:150],
                body.get("colonia") or None,
            ))

        return created(
            {"id": new_id, "comunidad": body["comunidad"], "barrio": body["barrio"]},
            f"Región registrada con ID {new_id}."
        )
    except Exception as exc:
        return db_error_response(exc)


# ================================================================
#  SUPERVISORES
# ================================================================

@director_bp.route("/api/supervisores", methods=["GET"])
@require_auth("director", "secretaria")
def get_supervisores(current_user):
    try:
        with get_db() as (_, cur):
            cur.execute("""
                SELECT
                    TRIM(s.codigo_personal)  AS "id",
                    TRIM(p.nombre)           AS "nombre",
                    TRIM(p.apellido_paterno) AS "apellidoPaterno",
                    TRIM(COALESCE(p.apellido_materno, '')) AS "apellidoMaterno",
                    s.telefono
                FROM public.supervisor s
                JOIN public.personal p
                    ON TRIM(s.codigo_personal) = TRIM(p.codigo_personal)
                ORDER BY p.apellido_paterno, p.nombre
            """)
            rows = [dict(r) for r in cur.fetchall()]
        return ok(rows)
    except Exception as exc:
        return db_error_response(exc)


# ================================================================
#  OBRAS
# ================================================================

@director_bp.route("/api/obras", methods=["GET"])
@require_auth("director", "supervisor", "proyectista", "secretaria")
def get_obras(current_user):
    """
    Lista obras con datos enriquecidos.
    Supervisores solo ven sus propias obras (filtro automático por rol).
    """
    supervisor_filter = request.args.get("supervisor")
    status_filter     = request.args.get("status")
    search            = request.args.get("q", "").strip()

    if current_user["role"] == "supervisor":
        supervisor_filter = current_user["id"]

    try:
        with get_db() as (_, cur):
            cur.execute("""
                SELECT
                    TRIM(o.id_obra)             AS "id",
                    TRIM(o.codigo_expediente)   AS "expediente",
                    TRIM(o.nombre_obra)         AS "nombre",
                    o.etapa,
                    o.fecha_inicio              AS "fechaInicio",
                    o.fecha_final               AS "fechaFin",
                    o.descripcion,
                    o.beneficiarios,
                    TRIM(o.id_constructora)     AS "constructoraId",
                    TRIM(c.nombre_const)        AS "constructoraNombre",
                    TRIM(c.tipo_ejecutor)       AS "constructoraTipo",
                    TRIM(o.id_region)           AS "regionId",
                    TRIM(r.comunidad)           AS "regionComunidad",
                    TRIM(r.barrio)              AS "regionBarrio",
                    r.colonia                   AS "regionColonia",
                    TRIM(o.codigo_supervisor)   AS "supervisorId",
                    TRIM(p.nombre || ' ' || p.apellido_paterno) AS "supervisorNombre",
                    COALESCE(o.status, 'activa') AS "status",
                    po.presupuesto_total        AS "presupuesto",
                    COALESCE(
                        json_agg(TRIM(f.id_fuente))
                        FILTER (WHERE f.id_fuente IS NOT NULL), '[]'
                    ) AS "fuentes"
                FROM public.obra o
                JOIN public.constructora c
                    ON TRIM(c.id_constructora) = TRIM(o.id_constructora)
                JOIN public.region r
                    ON TRIM(r.id_region) = TRIM(o.id_region)
                JOIN public.personal p
                    ON TRIM(p.codigo_personal) = TRIM(o.codigo_supervisor)
                LEFT JOIN public.financia f
                    ON TRIM(f.id_obra) = TRIM(o.id_obra)
                LEFT JOIN public.presupuesto_obra po
                    ON TRIM(po.id_obra) = TRIM(o.id_obra)
                WHERE
                    (%s IS NULL OR TRIM(o.codigo_supervisor) = %s)
                    AND (%s IS NULL OR TRIM(COALESCE(o.status, 'activa')) = %s)
                    AND (%s = '' OR (
                        LOWER(o.nombre_obra) LIKE '%%' || LOWER(%s) || '%%'
                        OR LOWER(o.codigo_expediente) LIKE '%%' || LOWER(%s) || '%%'
                    ))
                GROUP BY
                    o.id_obra, o.codigo_expediente, o.nombre_obra, o.etapa,
                    o.fecha_inicio, o.fecha_final, o.descripcion, o.beneficiarios,
                    o.id_constructora, c.nombre_const, c.tipo_ejecutor,
                    o.id_region, r.comunidad, r.barrio, r.colonia,
                    o.codigo_supervisor, p.nombre, p.apellido_paterno,
                    o.status, po.presupuesto_total
                ORDER BY o.fecha_inicio DESC NULLS LAST
            """, (
                supervisor_filter, supervisor_filter,
                status_filter, status_filter,
                search, search, search,
            ))
            obras = [dict(r) for r in cur.fetchall()]
        return ok(obras)
    except Exception as exc:
        return db_error_response(exc)


@director_bp.route("/api/obras", methods=["POST"])
@require_auth("director")
def create_obra(current_user):
    """
    PASO 3 del wizard. Recibe constructoraId y regionId ya persistidos.
    Body: { constructoraId, regionId, supervisorId, nombre, etapa,
            fechaInicio, fechaFin, descripcion, beneficiarios,
            presupuesto, fuentes[] }
    """
    body = request.get_json(silent=True) or {}
    valid, err = require_fields(
        body,
        "constructoraId", "regionId", "supervisorId",
        "nombre", "fechaInicio", "fechaFin",
    )
    if not valid:
        return err

    if body["fechaInicio"] >= body["fechaFin"]:
        return bad_request(
            "La fecha de inicio debe ser anterior a la fecha de finalización."
        )

    try:
        with get_db() as (_, cur):
            # Verificar existencia de FKs
            cur.execute(
                "SELECT 1 FROM public.constructora WHERE TRIM(id_constructora) = %s",
                (body["constructoraId"].strip(),)
            )
            if not cur.fetchone():
                return bad_request(
                    f"Constructora '{body['constructoraId']}' no encontrada. "
                    "Completa el Paso 1 primero."
                )

            cur.execute(
                "SELECT 1 FROM public.region WHERE TRIM(id_region) = %s",
                (body["regionId"].strip(),)
            )
            if not cur.fetchone():
                return bad_request(
                    f"Región '{body['regionId']}' no encontrada. "
                    "Completa el Paso 2 primero."
                )

            cur.execute(
                "SELECT 1 FROM public.supervisor WHERE TRIM(codigo_personal) = %s",
                (body["supervisorId"].strip(),)
            )
            if not cur.fetchone():
                return bad_request(
                    f"Supervisor '{body['supervisorId']}' no encontrado."
                )

            # Generar IDs
            anio     = body["fechaInicio"][:4]
            obra_id  = _next_id_obra(cur)
            exp      = _next_expediente(cur, anio)
            pres_id  = _next_id_presupuesto(cur)

            # INSERT obra
            cur.execute("""
                INSERT INTO public.obra (
                    id_obra, codigo_expediente, nombre_obra, etapa,
                    fecha_inicio, fecha_final, descripcion, beneficiarios,
                    id_constructora, id_region, codigo_supervisor
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING TRIM(id_obra) AS id
            """, (
                obra_id,
                exp.ljust(15),
                body["nombre"][:200],
                int(body.get("etapa", 1)),
                body["fechaInicio"],
                body["fechaFin"],
                (body.get("descripcion") or "Sin descripción.")[:2000],
                (body.get("beneficiarios") or "Por definir.")[:2000],
                body["constructoraId"].strip().ljust(10),
                body["regionId"].strip().ljust(5),
                body["supervisorId"].strip().ljust(20),
            ))
            inserted_id = list(cur.fetchone().values())[0]

            # INSERT presupuesto_obra
            presupuesto = float(body.get("presupuesto") or 0)
            if presupuesto > 0:
                cur.execute("""
                    SELECT TRIM(codigo_personal) AS id
                    FROM public.proyectista LIMIT 1
                """)
                proy_row = cur.fetchone()
                proy_id  = list(proy_row.values())[0] if proy_row else "PRY0000000000000001"

                cur.execute("""
                    INSERT INTO public.presupuesto_obra
                        (id_presupuesto, presupuesto_total, id_proyectista, id_obra)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (id_obra) DO NOTHING
                """, (
                    pres_id.ljust(10),
                    presupuesto,
                    proy_id.ljust(20),
                    obra_id,
                ))

            # INSERT fuentes
            for fuente_id in (body.get("fuentes") or []):
                cur.execute("""
                    INSERT INTO public.financia (id_obra, id_fuente)
                    VALUES (%s, %s)
                    ON CONFLICT DO NOTHING
                """, (obra_id, fuente_id.strip().ljust(10)))

        return created(
            {
                "id":           inserted_id.strip(),
                "expediente":   exp,
                "presupuestoId": pres_id if presupuesto > 0 else None,
            },
            f"Obra '{body['nombre']}' registrada con expediente {exp}."
        )
    except Exception as exc:
        return db_error_response(exc)


@director_bp.route("/api/obras/<obra_id>", methods=["DELETE"])
@require_auth("director")
def delete_obra(obra_id, current_user):
    try:
        clean = obra_id.strip()
        with get_db() as (_, cur):
            cur.execute(
                "SELECT 1 FROM public.acta_entrega WHERE TRIM(id_obra) = %s", (clean,)
            )
            if cur.fetchone():
                return bad_request(
                    "No se puede eliminar una obra con Acta de Entrega registrada."
                )

            cur.execute("""
                DELETE FROM public.obra WHERE TRIM(id_obra) = %s
                RETURNING TRIM(id_obra) AS id
            """, (clean,))
            if not cur.fetchone():
                return not_found(f"Obra '{clean}' no encontrada.")

        return ok(message=f"Obra '{clean}' eliminada junto con sus dependencias.")
    except Exception as exc:
        return db_error_response(exc)


@director_bp.route("/api/obras/<obra_id>/fuentes", methods=["POST"])
@require_auth("director")
def add_fuente_to_obra(obra_id, current_user):
    body = request.get_json(silent=True) or {}
    fuente_id = (body.get("fuenteId") or "").strip()
    if not fuente_id:
        return bad_request("Falta el campo 'fuenteId'.")
    try:
        with get_db() as (_, cur):
            cur.execute("""
                INSERT INTO public.financia (id_obra, id_fuente)
                VALUES (%s, %s) ON CONFLICT DO NOTHING
            """, (obra_id.strip().ljust(20), fuente_id.ljust(10)))
        return created(message="Fuente vinculada a la obra.")
    except Exception as exc:
        return db_error_response(exc)


# ================================================================
#  FUENTES
# ================================================================

@director_bp.route("/api/fuentes", methods=["GET"])
@require_auth("director", "supervisor", "proyectista", "secretaria")
def get_fuentes(current_user):
    try:
        with get_db() as (_, cur):
            cur.execute("""
                SELECT
                    TRIM(id_fuente)   AS "id",
                    TRIM(grado_nivel) AS "nivel",
                    programa
                FROM public.fuente_presupuestaria
                ORDER BY grado_nivel, programa
            """)
            rows = [dict(r) for r in cur.fetchall()]
        return ok(rows)
    except Exception as exc:
        return db_error_response(exc)


# ================================================================
#  CONCURSO — solo lectura (escritura en secretaria.py)
# ================================================================

@director_bp.route("/api/concursos", methods=["GET"])
@require_auth("director", "supervisor", "secretaria")
def get_concursos(current_user):
    obra_filter = request.args.get("obra")
    try:
        with get_db() as (_, cur):
            cur.execute("""
                SELECT
                    TRIM(s.id_participante)   AS "id",
                    TRIM(s.id_obra)           AS "obraId",
                    TRIM(o.nombre_obra)       AS "obraNombre",
                    TRIM(o.codigo_expediente) AS "expediente",
                    TRIM(s.constructora)      AS "constructora",
                    s.aprobado,
                    s.razones_decision        AS "razones"
                FROM public.opcion_seleccion s
                JOIN public.obra o ON TRIM(o.id_obra) = TRIM(s.id_obra)
                WHERE (%s IS NULL OR TRIM(s.id_obra) = %s)
                ORDER BY s.id_participante DESC
            """, (obra_filter, obra_filter))
            rows = [dict(r) for r in cur.fetchall()]
        return ok(rows)
    except Exception as exc:
        return db_error_response(exc)
