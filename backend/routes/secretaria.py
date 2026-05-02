from flask import Blueprint, request
from app.database import get_db
from app.helpers import (
    ok, created, bad_request, not_found, db_error_response, require_fields,
)

secretaria_bp = Blueprint("secretaria", __name__)


# ── Generadores de ID ────────────────────────────────────────────

def _gen_oficio_id(cur) -> str:
    """
    id_oficio CHAR(20) → OFI + 17 dígitos
    Ejemplo: OFI00000000000000001
    """
    cur.execute(
        "SELECT id_oficio FROM public.permisos ORDER BY id_oficio DESC LIMIT 1"
    )
    row = cur.fetchone()
    if not row:
        num = 1
    else:
        last = (row["id_oficio"] or "OFI" + "0" * 17).strip()
        try:
            num = int(last[3:]) + 1
        except ValueError:
            cur.execute("SELECT COUNT(*) AS n FROM public.permisos")
            num = cur.fetchone()["n"] + 1
    return f"OFI{num:017d}"  # 3 + 17 = 20 chars


def _gen_acta_id(cur) -> str:
    """
    id_acta CHAR(10) → ACT + 7 dígitos
    Ejemplo: ACT0000001
    """
    cur.execute(
        "SELECT id_acta FROM public.acta_entrega ORDER BY id_acta DESC LIMIT 1"
    )
    row = cur.fetchone()
    if not row:
        num = 1
    else:
        last = (row["id_acta"] or "ACT0000000").strip()
        try:
            num = int(last[3:]) + 1
        except ValueError:
            cur.execute("SELECT COUNT(*) AS n FROM public.acta_entrega")
            num = cur.fetchone()["n"] + 1
    return f"ACT{num:07d}"  # 3 + 7 = 10 chars


def _gen_firmante_id(cur) -> str:
    """
    id_firmante CHAR(10) → FRM + 7 dígitos
    Ejemplo: FRM0000001
    """
    cur.execute(
        "SELECT id_firmante FROM public.firmantes ORDER BY id_firmante DESC LIMIT 1"
    )
    row = cur.fetchone()
    if not row:
        num = 1
    else:
        last = (row["id_firmante"] or "FRM0000000").strip()
        try:
            num = int(last[3:]) + 1
        except ValueError:
            cur.execute("SELECT COUNT(*) AS n FROM public.firmantes")
            num = cur.fetchone()["n"] + 1
    return f"FRM{num:07d}"  # 3 + 7 = 10 chars


def _gen_participante_id(cur) -> str:
    """
    id_participante CHAR(10) → PART + 6 dígitos
    Ejemplo: PART000001
    """
    cur.execute(
        "SELECT id_participante FROM public.opcion_seleccion "
        "ORDER BY id_participante DESC LIMIT 1"
    )
    row = cur.fetchone()
    if not row:
        num = 1
    else:
        last = (row["id_participante"] or "PART000000").strip()
        try:
            num = int(last[4:]) + 1
        except ValueError:
            cur.execute("SELECT COUNT(*) AS n FROM public.opcion_seleccion")
            num = cur.fetchone()["n"] + 1
    return f"PART{num:06d}"  # 4 + 6 = 10 chars


# ════════════════════════════════════════════════════════════════
#  PERMISOS
#  Tabla: public.permisos
#  Columnas: id_oficio, nombre_instancia, oficio_acreditacion, id_obra
# ════════════════════════════════════════════════════════════════

@secretaria_bp.route("/api/permisos", methods=["GET"])
@require_auth("secretaria", "director")
def get_permisos(current_user):
    """
    SELECT id_oficio, nombre_instancia, oficio_acreditacion, id_obra
    FROM public.permisos
    """
    try:
        with get_db() as (conn, cur):
            cur.execute("""
                SELECT
                    TRIM(p.id_oficio)             AS id,
                    TRIM(p.id_obra)               AS "obraId",
                    TRIM(o.nombre_obra)           AS "obraNombre",
                    TRIM(p.nombre_instancia)      AS instancia,
                    p.oficio_acreditacion         AS oficio
                FROM public.permisos p
                LEFT JOIN public.obra o
                    ON TRIM(o.id_obra) = TRIM(p.id_obra)
                ORDER BY p.id_oficio DESC
            """)
            rows = [dict(r) for r in cur.fetchall()]
        return ok(rows)
    except Exception as exc:
        return db_error_response(exc)


@secretaria_bp.route("/api/permisos", methods=["POST"])
@require_auth("secretaria")
def create_permiso(current_user):
    """
    Body: { "obraId", "instancia", "oficio" }

    INSERT INTO public.permisos
        (id_oficio, nombre_instancia, oficio_acreditacion, id_obra)
    VALUES (...)
    """
    body = request.get_json(silent=True) or {}
    valid, err = require_fields(body, "obraId", "instancia", "oficio")
    if not valid:
        return err

    obra_id   = body["obraId"].strip()
    instancia = body["instancia"].strip()[:200]
    oficio    = body["oficio"].strip()

    try:
        with get_db() as (conn, cur):
            # Verificar que la obra existe
            cur.execute(
                "SELECT 1 FROM public.obra WHERE TRIM(id_obra) = %s",
                (obra_id,)
            )
            if not cur.fetchone():
                return bad_request(f"La obra '{obra_id}' no existe.")

            new_id = _gen_oficio_id(cur)

            cur.execute("""
                INSERT INTO public.permisos
                    (id_oficio, nombre_instancia, oficio_acreditacion, id_obra)
                VALUES (%s, %s, %s, %s)
            """, (new_id, instancia, oficio, obra_id))

        return created({"id": new_id}, f"Permiso {new_id} registrado.")
    except Exception as exc:
        return db_error_response(exc)


@secretaria_bp.route("/api/permisos/<oficio_id>", methods=["DELETE"])
@require_auth("secretaria")
def delete_permiso(oficio_id, current_user):
    try:
        with get_db() as (conn, cur):
            cur.execute(
                "DELETE FROM public.permisos "
                "WHERE TRIM(id_oficio) = %s RETURNING TRIM(id_oficio) AS id",
                (oficio_id.strip(),)
            )
            if not cur.fetchone():
                return not_found("Permiso no encontrado.")
        return ok(message="Permiso eliminado.")
    except Exception as exc:
        return db_error_response(exc)


# ════════════════════════════════════════════════════════════════
#  ACTAS DE ENTREGA
#  Tabla: public.acta_entrega
#  Columnas: id_acta, acta_entrega, fecha_expedicion, id_obra
#  Nota: id_acta también es FK hacia obra.id_obra (rel_obra)
#        UNIQUE id_obra → una sola acta por obra (re_1_1)
#
#  Tabla hija: public.firmantes
#  Columnas: id_firmante, nombre, apellido_paterno,
#            apellido_materno, cargo, id_acta
# ════════════════════════════════════════════════════════════════

@secretaria_bp.route("/api/actas", methods=["GET"])
@require_auth("secretaria", "director")
def get_actas(current_user):
    obra_filter = request.args.get("obra")
    try:
        with get_db() as (conn, cur):
            cur.execute("""
                SELECT
                    TRIM(a.id_acta)      AS id,
                    TRIM(a.id_obra)      AS "obraId",
                    TRIM(o.nombre_obra)  AS "obraNombre",
                    a.acta_entrega       AS contenido,
                    a.fecha_expedicion   AS fecha
                FROM public.acta_entrega a
                LEFT JOIN public.obra o
                    ON TRIM(o.id_obra) = TRIM(a.id_obra)
                WHERE (%s IS NULL OR TRIM(a.id_obra) = %s)
                ORDER BY a.fecha_expedicion DESC NULLS LAST
            """, (obra_filter, obra_filter))
            actas = [dict(r) for r in cur.fetchall()]

            # Firmantes de cada acta
            for acta in actas:
                cur.execute("""
                    SELECT
                        TRIM(cargo)            AS cargo,
                        TRIM(nombre)           AS nombre,
                        TRIM(apellido_paterno) AS "apellidoP",
                        TRIM(COALESCE(apellido_materno, '')) AS "apellidoM"
                    FROM public.firmantes
                    WHERE TRIM(id_acta) = %s
                    ORDER BY id_firmante
                """, (acta["id"],))
                acta["firmantes"] = [dict(r) for r in cur.fetchall()]

        return ok(actas)
    except Exception as exc:
        return db_error_response(exc)


@secretaria_bp.route("/api/actas", methods=["POST"])
@require_auth("secretaria")
def create_acta(current_user):
    """
    Body: { "obraId", "fecha", "contenido"?, "firmantes": [...] }

    firmantes item: { cargo, nombre, apellidoP, apellidoM? }
    Mínimo 3 firmantes completos (nombre + apellidoP).

    INSERT INTO public.acta_entrega
        (id_acta, acta_entrega, fecha_expedicion, id_obra)

    INSERT INTO public.firmantes
        (id_firmante, nombre, apellido_paterno, apellido_materno, cargo, id_acta)
    """
    body = request.get_json(silent=True) or {}
    valid, err = require_fields(body, "obraId", "fecha")
    if not valid:
        return err

    obra_id   = body["obraId"].strip()
    fecha     = body["fecha"]
    contenido = (body.get("contenido") or "").strip() or "Acta de entrega."
    firmantes = body.get("firmantes") or []

    completos = [
        f for f in firmantes
        if (f.get("nombre") or "").strip() and (f.get("apellidoP") or "").strip()
    ]
    if len(completos) < 3:
        return bad_request(
            "Se requieren al menos 3 firmantes con nombre y apellido paterno."
        )

    try:
        with get_db() as (conn, cur):
            # Verificar obra
            cur.execute(
                "SELECT 1 FROM public.obra WHERE TRIM(id_obra) = %s",
                (obra_id,)
            )
            if not cur.fetchone():
                return bad_request(f"La obra '{obra_id}' no existe.")

            # Verificar unicidad (re_1_1: UNIQUE id_obra)
            cur.execute(
                "SELECT TRIM(id_acta) AS id FROM public.acta_entrega "
                "WHERE TRIM(id_obra) = %s",
                (obra_id,)
            )
            existing = cur.fetchone()
            if existing:
                return bad_request(
                    f"Esta obra ya tiene un Acta de Entrega registrada "
                    f"(ID: {existing['id'].strip()}). Solo puede haber una acta por obra."
                )

            acta_id = _gen_acta_id(cur)

            # INSERT acta_entrega
            cur.execute("""
                INSERT INTO public.acta_entrega
                    (id_acta, acta_entrega, fecha_expedicion, id_obra)
                VALUES (%s, %s, %s, %s)
            """, (acta_id, contenido, fecha, obra_id))

            # INSERT firmantes
            for f in completos:
                firm_id = _gen_firmante_id(cur)
                cur.execute("""
                    INSERT INTO public.firmantes
                        (id_firmante, nombre, apellido_paterno,
                         apellido_materno, cargo, id_acta)
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, (
                    firm_id,
                    f["nombre"].strip()[:100],
                    f["apellidoP"].strip()[:200],
                    (f.get("apellidoM") or "").strip()[:200] or None,
                    (f.get("cargo") or "").strip()[:100],
                    acta_id,
                ))

        return created(
            {"id": acta_id, "firmantes": len(completos)},
            f"Acta {acta_id} registrada con {len(completos)} firmantes."
        )
    except Exception as exc:
        return db_error_response(exc)


@secretaria_bp.route("/api/actas/<acta_id>", methods=["DELETE"])
@require_auth("secretaria")
def delete_acta(acta_id, current_user):
    """
    Los firmantes se eliminan por CASCADE (rel_acta ON DELETE CASCADE).
    """
    try:
        with get_db() as (conn, cur):
            cur.execute(
                "DELETE FROM public.acta_entrega "
                "WHERE TRIM(id_acta) = %s RETURNING TRIM(id_acta) AS id",
                (acta_id.strip(),)
            )
            if not cur.fetchone():
                return not_found("Acta no encontrada.")
        return ok(message="Acta eliminada.")
    except Exception as exc:
        return db_error_response(exc)


# ════════════════════════════════════════════════════════════════
#  CONCURSO DE SELECCIÓN
#  Tabla: public.opcion_seleccion
#  Columnas: id_participante, constructora, aprobado,
#            razones_decision, id_obra
#  (No hay rfc ni monto_propuesta en la BD real)
# ════════════════════════════════════════════════════════════════

@secretaria_bp.route("/api/concursos", methods=["GET"])
@require_auth("secretaria", "director", "supervisor")
def get_concursos(current_user):
    obra_filter = request.args.get("obra")
    try:
        with get_db() as (conn, cur):
            cur.execute("""
                SELECT
                    TRIM(s.id_participante)  AS id,
                    TRIM(s.id_obra)          AS "obraId",
                    TRIM(o.nombre_obra)      AS "obraNombre",
                    TRIM(s.constructora)     AS constructora,
                    s.aprobado,
                    s.razones_decision       AS razones
                FROM public.opcion_seleccion s
                LEFT JOIN public.obra o
                    ON TRIM(o.id_obra) = TRIM(s.id_obra)
                WHERE (%s IS NULL OR TRIM(s.id_obra) = %s)
                ORDER BY s.aprobado DESC, s.id_participante DESC
            """, (obra_filter, obra_filter))
            rows = [dict(r) for r in cur.fetchall()]
        return ok(rows)
    except Exception as exc:
        return db_error_response(exc)


@secretaria_bp.route("/api/concursos", methods=["POST"])
@require_auth("secretaria")
def create_concurso(current_user):
    """
    Body: { "obraId", "constructora", "razones", "aprobado" }

    Regla: solo 1 aprobado por obra.

    INSERT INTO public.opcion_seleccion
        (id_participante, constructora, aprobado, razones_decision, id_obra)
    """
    body = request.get_json(silent=True) or {}
    valid, err = require_fields(body, "obraId", "constructora", "razones")
    if not valid:
        return err

    obra_id      = body["obraId"].strip()
    constructora = body["constructora"].strip()[:200]
    aprobado     = bool(body.get("aprobado", False))
    razones      = body["razones"].strip()

    try:
        with get_db() as (conn, cur):
            # Verificar que la obra existe
            cur.execute(
                "SELECT 1 FROM public.obra WHERE TRIM(id_obra) = %s",
                (obra_id,)
            )
            if not cur.fetchone():
                return bad_request(
                    f"La obra '{obra_id}' no existe. Regístrala primero."
                )

            # Verificar unicidad del aprobado
            if aprobado:
                cur.execute("""
                    SELECT TRIM(constructora) AS c
                    FROM public.opcion_seleccion
                    WHERE TRIM(id_obra) = %s AND aprobado = true
                    LIMIT 1
                """, (obra_id,))
                ya = cur.fetchone()
                if ya:
                    return bad_request(
                        f"La obra ya tiene una constructora aprobada: "
                        f"'{ya['c'].strip()}'. Solo puede haber una ganadora."
                    )

            new_id = _gen_participante_id(cur)

            cur.execute("""
                INSERT INTO public.opcion_seleccion
                    (id_participante, constructora, aprobado,
                     razones_decision, id_obra)
                VALUES (%s, %s, %s, %s, %s)
            """, (new_id, constructora, aprobado, razones, obra_id))

        return created(
            {"id": new_id, "constructora": constructora, "aprobado": aprobado},
            f"Participante '{constructora}' registrado: {new_id}."
        )
    except Exception as exc:
        return db_error_response(exc)


@secretaria_bp.route("/api/concursos/<participante_id>", methods=["DELETE"])
@require_auth("secretaria")
def delete_concurso(participante_id, current_user):
    try:
        with get_db() as (conn, cur):
            cur.execute("""
                DELETE FROM public.opcion_seleccion
                WHERE TRIM(id_participante) = %s
                RETURNING TRIM(constructora) AS c
            """, (participante_id.strip(),))
            row = cur.fetchone()
            if not row:
                return not_found("Participante no encontrado.")
        return ok(message=f"Participante '{row['c'].strip()}' eliminado.")
    except Exception as exc:
        return db_error_response(exc)
