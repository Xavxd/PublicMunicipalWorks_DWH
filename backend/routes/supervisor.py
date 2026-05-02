from flask import Blueprint, request
from app.database import get_db
from app.helpers import ok, created, bad_request, not_found, db_error_response, require_fields
import time

supervisor_bp = Blueprint("supervisor", __name__)


@supervisor_bp.route("/api/informes", methods=["GET"])
@require_auth("director", "supervisor")
def get_informes(current_user):
    obra_filter = request.args.get("obra")
    anio_filter = request.args.get("anio")
    supervisor_id = current_user["id"] if current_user["role"] == "supervisor" else None

    try:
        with get_db() as (_, cur):
            cur.execute("""
                SELECT
                    TRIM(i.id_informe)                          AS "id",
                    TRIM(i.id_obra)                             AS "obraId",
                    TRIM(o.codigo_expediente)                   AS "obraExpediente",
                    TRIM(o.nombre_obra)                         AS "obraNombre",
                    TRIM(i.codigo_supervisor)                   AS "supervisorId",
                    TRIM(p.nombre || ' ' || p.apellido_paterno) AS "supervisorNombre",
                    i.ano_infor                                 AS "anio",
                    TRIM(i.mes)                                 AS "mes",
                    i.porcentaje_avance_fisico                  AS "avanceFisico",
                    i.porcentaje_avance_presupuestario          AS "avanceFinanciero",
                    i.descripcion,
                    i.doc_infome                               AS "documento"
                FROM public.informes i
                JOIN public.obra o     ON TRIM(o.id_obra)        = TRIM(i.id_obra)
                JOIN public.personal p ON TRIM(p.codigo_personal) = TRIM(i.codigo_supervisor)
                WHERE (%s IS NULL OR TRIM(i.codigo_supervisor) = %s)
                  AND (%s IS NULL OR TRIM(i.id_obra)           = %s)
                  AND (%s IS NULL OR i.ano_infor               = %s::int)
                ORDER BY i.ano_infor DESC, i.mes ASC
            """, (
                supervisor_id, supervisor_id,
                obra_filter,   obra_filter,
                anio_filter,   anio_filter,
            ))
            rows = [dict(r) for r in cur.fetchall()]
        return ok(rows)
    except Exception as exc:
        return db_error_response(exc)


@supervisor_bp.route("/api/informes", methods=["POST"])
@require_auth("supervisor")
def create_informe(current_user):
    body = request.get_json(silent=True) or {}
    valid, err = require_fields(
        body, "obraId", "anio", "mes", "avanceFisico", "avanceFinanciero"
    )
    if not valid:
        return err

    informe_id = f"INF-{int(time.time()) % 10_000_000:07d}"

    try:
        with get_db() as (_, cur):
            cur.execute(
                "SELECT 1 FROM public.obra WHERE TRIM(id_obra) = %s AND TRIM(codigo_supervisor) = %s",
                (body["obraId"], current_user["id"])
            )
            if not cur.fetchone():
                return bad_request("No tienes permiso para reportar en esta obra.")

            cur.execute("""
                INSERT INTO public.informes (
                    id_informe, ano_infor, mes,
                    porcentaje_avance_fisico,
                    porcentaje_avance_presupuestario,
                    doc_infome, descripcion,
                    id_obra, codigo_supervisor
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING TRIM(id_informe) AS id
            """, (
                informe_id.ljust(20),
                int(body["anio"]),
                str(body["mes"]).ljust(30),
                int(body["avanceFisico"]),
                int(body["avanceFinanciero"]),
                body.get("documento", ""),
                body.get("descripcion", ""),
                body["obraId"],
                current_user["id"],
            ))

        return created({"id": informe_id}, "Informe mensual guardado.")
    except Exception as exc:
        return db_error_response(exc)


@supervisor_bp.route("/api/informes/<informe_id>", methods=["GET"])
@require_auth("director", "supervisor")
def get_informe(informe_id, current_user):
    try:
        with get_db() as (_, cur):
            cur.execute("""
                SELECT
                    TRIM(i.id_informe)                          AS "id",
                    TRIM(i.id_obra)                             AS "obraId",
                    TRIM(o.nombre_obra)                         AS "obraNombre",
                    TRIM(i.codigo_supervisor)                   AS "supervisorId",
                    TRIM(p.nombre || ' ' || p.apellido_paterno) AS "supervisorNombre",
                    i.ano_infor                                 AS "anio",
                    TRIM(i.mes)                                 AS "mes",
                    i.porcentaje_avance_fisico                  AS "avanceFisico",
                    i.porcentaje_avance_presupuestario          AS "avanceFinanciero",
                    i.descripcion,
                    i.doc_infome                               AS "documento"
                FROM public.informes i
                JOIN public.obra o     ON TRIM(o.id_obra)        = TRIM(i.id_obra)
                JOIN public.personal p ON TRIM(p.codigo_personal) = TRIM(i.codigo_supervisor)
                WHERE TRIM(i.id_informe) = %s
            """, (informe_id.strip(),))
            row = cur.fetchone()

        if not row:
            return not_found(f"Informe '{informe_id}' no encontrado.")
        return ok(dict(row))
    except Exception as exc:
        return db_error_response(exc)


@supervisor_bp.route("/api/informes/<informe_id>", methods=["DELETE"])
@require_auth("supervisor", "director")
def delete_informe(informe_id, current_user):
    try:
        with get_db() as (_, cur):
            if current_user["role"] == "supervisor":
                cur.execute(
                    "SELECT 1 FROM public.informes WHERE TRIM(id_informe) = %s AND TRIM(codigo_supervisor) = %s",
                    (informe_id, current_user["id"])
                )
                if not cur.fetchone():
                    return bad_request("Acceso denegado a este informe.")

            cur.execute(
                "DELETE FROM public.informes WHERE TRIM(id_informe) = %s RETURNING id_informe",
                (informe_id,)
            )
            if not cur.fetchone():
                return not_found("El informe no existe.")

        return ok(message="Informe eliminado.")
    except Exception as exc:
        return db_error_response(exc)
