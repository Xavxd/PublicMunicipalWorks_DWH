# Back/app/routes/secretaria.py
# ================================================================
#  MÓDULO: SECRETARÍA
#
#  Endpoints:
#    Permisos:
#      GET  /api/permisos            → lista oficios
#      POST /api/permisos            → nuevo oficio
#      DELETE /api/permisos/<id>     → elimina oficio
#
#    Actas:
#      GET  /api/actas               → lista actas
#      POST /api/actas               → nueva acta + firmantes
#      DELETE /api/actas/<id>        → elimina acta + firmantes
#
#    Concursos:
#      GET  /api/concursos           → lista (filtro ?obra=)
#      POST /api/concursos           → nueva entrada
#          ⚠ Validación: solo UN aprobado por obra
#          ⚠ ID generado automáticamente (PART000001)
#      DELETE /api/concursos/<id>    → elimina participante
#
#  Nota: GET /api/concursos también lo usa el director (lectura).
# ================================================================

from flask import Blueprint, request
from app.database import get_db
from app.helpers import (
    ok, created, bad_request, not_found, db_error_response, require_fields,
)
from app.middleware.auth import require_auth

secretaria_bp = Blueprint("secretaria", __name__)


# ── Generadores de ID ────────────────────────────────────────────

def _gen_permiso_id(cur) -> str:
    """PRM000001 … PRM999999 — CHAR(10)"""
    cur.execute(
        "SELECT id_permiso FROM public.permiso ORDER BY id_permiso DESC LIMIT 1"
    )
    row = cur.fetchone()
    num = 1 if not row else _next_num(row["id_permiso"], 3)
    return f"PRM{num:06d}"


def _gen_acta_id(cur) -> str:
    """ACT000001 … ACT999999 — CHAR(10)"""
    cur.execute(
        "SELECT id_acta FROM public.acta_entrega ORDER BY id_acta DESC LIMIT 1"
    )
    row = cur.fetchone()
    num = 1 if not row else _next_num(row["id_acta"], 3)
    return f"ACT{num:06d}"


def _gen_participante_id(cur) -> str:
    """
    PART000001 … PART999999 — ajusta el largo a la columna
    id_participante de public.opcion_seleccion.
    """
    cur.execute(
        "SELECT id_participante FROM public.opcion_seleccion ORDER BY id_participante DESC LIMIT 1"
    )
    row = cur.fetchone()
    num = 1 if not row else _next_num(row["id_participante"], 4)
    return f"PART{num:06d}"


def _next_num(last_id: str, prefix_len: int) -> int:
    """Extrae el número del último ID y suma 1."""
    try:
        return int(last_id.strip()[prefix_len:]) + 1
    except (ValueError, IndexError):
        return 1


# ════════════════════════════════════════════════════════════════
#  PERMISOS
# ════════════════════════════════════════════════════════════════

@secretaria_bp.route("/api/permisos", methods=["GET"])
@require_auth("secretaria", "director")
def get_permisos(current_user):
    """
    Lista todos los oficios de permiso.
    Respuesta item: { id, obraId, obraNombre, instancia, oficio, fecha, desc }
    """
    try:
        with get_db() as (conn, cur):
            cur.execute("""
                SELECT
                    TRIM(p.id_permiso)        AS id,
                    TRIM(p.id_obra)           AS "obraId",
                    TRIM(o.nombre_obra)       AS "obraNombre",
                    TRIM(p.instancia)         AS instancia,
                    TRIM(p.numero_oficio)     AS oficio,
                    p.fecha_oficio            AS fecha,
                    p.descripcion             AS desc
                FROM public.permiso p
                LEFT JOIN public.obra o ON TRIM(o.id_obra) = TRIM(p.id_obra)
                ORDER BY p.fecha_oficio DESC NULLS LAST
            """)
            rows = [dict(r) for r in cur.fetchall()]
        return ok(rows)
    except Exception as exc:
        return db_error_response(exc)


@secretaria_bp.route("/api/permisos", methods=["POST"])
@require_auth("secretaria")
def create_permiso(current_user):
    """
    Registra un nuevo oficio de permiso.

    Body JSON:
    {
      "obraId":    "OBRA0000000000000001",
      "instancia": "CFE",
      "oficio":    "Oficio CFE-2025-001",
      "fecha":     "2025-06-15",          ← opcional
      "desc":      "Permiso de conexión"  ← opcional
    }

    SQL:
      INSERT INTO public.permiso
        (id_permiso, id_obra, instancia, numero_oficio, fecha_oficio, descripcion)
      VALUES (...)
    """
    body = request.get_json(silent=True) or {}
    valid, err = require_fields(body, "obraId", "instancia", "oficio")
    if not valid:
        return err

    obra_id   = body["obraId"].strip()
    instancia = body["instancia"].strip()[:100]
    oficio    = body["oficio"].strip()[:200]
    fecha     = body.get("fecha") or None
    desc      = (body.get("desc") or "").strip() or None

    try:
        with get_db() as (conn, cur):

            # Verificar que la obra existe
            cur.execute(
                "SELECT 1 FROM public.obra WHERE TRIM(id_obra) = %s", (obra_id,)
            )
            if not cur.fetchone():
                return bad_request(f"La obra '{obra_id}' no existe.")

            new_id = _gen_permiso_id(cur)

            cur.execute("""
                INSERT INTO public.permiso
                    (id_permiso, id_obra, instancia, numero_oficio, fecha_oficio, descripcion)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (new_id, obra_id, instancia, oficio, fecha, desc))

        return created({"id": new_id}, f"Permiso {new_id} registrado.")
    except Exception as exc:
        return db_error_response(exc)


@secretaria_bp.route("/api/permisos/<permiso_id>", methods=["DELETE"])
@require_auth("secretaria")
def delete_permiso(permiso_id, current_user):
    try:
        with get_db() as (conn, cur):
            cur.execute(
                "DELETE FROM public.permiso WHERE TRIM(id_permiso) = %s RETURNING id_permiso",
                (permiso_id.strip(),)
            )
            if not cur.fetchone():
                return not_found("Permiso no encontrado.")
        return ok(message="Permiso eliminado.")
    except Exception as exc:
        return db_error_response(exc)


# ════════════════════════════════════════════════════════════════
#  ACTAS DE ENTREGA
# ════════════════════════════════════════════════════════════════

@secretaria_bp.route("/api/actas", methods=["GET"])
@require_auth("secretaria", "director")
def get_actas(current_user):
    """
    Lista actas de entrega con sus firmantes.
    Respuesta item:
    { id, obraId, obraNombre, fecha, obs, firmantes: [...] }
    """
    obra_filter = request.args.get("obra")
    try:
        with get_db() as (conn, cur):
            cur.execute("""
                SELECT
                    TRIM(a.id_acta)       AS id,
                    TRIM(a.id_obra)       AS "obraId",
                    TRIM(o.nombre_obra)   AS "obraNombre",
                    a.numero_acta         AS "numeroActa",
                    a.fecha_expedicion    AS fecha,
                    a.observaciones       AS obs
                FROM public.acta_entrega a
                LEFT JOIN public.obra o ON TRIM(o.id_obra) = TRIM(a.id_obra)
                WHERE (%s IS NULL OR TRIM(a.id_obra) = %s)
                ORDER BY a.fecha_expedicion DESC NULLS LAST
            """, (obra_filter, obra_filter))
            actas = [dict(r) for r in cur.fetchall()]

            # Firmantes de cada acta
            for acta in actas:
                cur.execute("""
                    SELECT
                        cargo,
                        nombre,
                        apellido_paterno  AS "apellidoP",
                        apellido_materno  AS "apellidoM"
                    FROM public.firmante_acta
                    WHERE TRIM(id_acta) = %s
                    ORDER BY id
                """, (acta["id"],))
                acta["firmantes"] = [dict(r) for r in cur.fetchall()]

        return ok(actas)
    except Exception as exc:
        return db_error_response(exc)


@secretaria_bp.route("/api/actas", methods=["POST"])
@require_auth("secretaria")
def create_acta(current_user):
    """
    Registra un acta de entrega con todos sus firmantes.

    Body JSON:
    {
      "obraId":     "OBRA0000000000000001",
      "numeroActa": "ACT-2025-001",         ← opcional (se genera si no viene)
      "fecha":      "2025-08-30",
      "obs":        "Sin observaciones",
      "firmantes": [
        { "cargo": "Presidente Municipal", "nombre": "Juan",
          "apellidoP": "Pérez", "apellidoM": "García" },
        ...
      ]
    }

    Operaciones (transacción única):
      INSERT public.acta_entrega
      INSERT public.firmante_acta  (una fila por firmante con nombre)
    """
    body = request.get_json(silent=True) or {}
    valid, err = require_fields(body, "obraId", "fecha")
    if not valid:
        return err

    obra_id    = body["obraId"].strip()
    num_acta   = (body.get("numeroActa") or "").strip() or None
    fecha      = body["fecha"]
    obs        = (body.get("obs") or "").strip() or None
    firmantes  = body.get("firmantes") or []

    # Validar mínimo de firmantes
    completos = [f for f in firmantes if f.get("nombre") and f.get("apellidoP")]
    if len(completos) < 3:
        return bad_request(
            "Se requieren al menos 3 firmantes con nombre y apellido paterno."
        )

    try:
        with get_db() as (conn, cur):

            cur.execute(
                "SELECT 1 FROM public.obra WHERE TRIM(id_obra) = %s", (obra_id,)
            )
            if not cur.fetchone():
                return bad_request(f"La obra '{obra_id}' no existe.")

            acta_id = _gen_acta_id(cur)

            cur.execute("""
                INSERT INTO public.acta_entrega
                    (id_acta, id_obra, numero_acta, fecha_expedicion, observaciones)
                VALUES (%s, %s, %s, %s, %s)
            """, (acta_id, obra_id, num_acta or acta_id, fecha, obs))

            for f in firmantes:
                nombre = (f.get("nombre") or "").strip()
                if not nombre:
                    continue
                cur.execute("""
                    INSERT INTO public.firmante_acta
                        (id_acta, cargo, nombre, apellido_paterno, apellido_materno)
                    VALUES (%s, %s, %s, %s, %s)
                """, (
                    acta_id,
                    (f.get("cargo") or "").strip()[:100],
                    nombre[:100],
                    (f.get("apellidoP") or "").strip()[:100],
                    (f.get("apellidoM") or "").strip()[:100] or None,
                ))

        return created({"id": acta_id}, f"Acta {acta_id} registrada.")
    except Exception as exc:
        return db_error_response(exc)


@secretaria_bp.route("/api/actas/<acta_id>", methods=["DELETE"])
@require_auth("secretaria")
def delete_acta(acta_id, current_user):
    try:
        with get_db() as (conn, cur):
            cur.execute(
                "DELETE FROM public.firmante_acta WHERE TRIM(id_acta) = %s",
                (acta_id.strip(),)
            )
            cur.execute(
                "DELETE FROM public.acta_entrega WHERE TRIM(id_acta) = %s RETURNING id_acta",
                (acta_id.strip(),)
            )
            if not cur.fetchone():
                return not_found("Acta no encontrada.")
        return ok(message="Acta eliminada.")
    except Exception as exc:
        return db_error_response(exc)


# ════════════════════════════════════════════════════════════════
#  CONCURSOS DE SELECCIÓN
# ════════════════════════════════════════════════════════════════

@secretaria_bp.route("/api/concursos", methods=["GET"])
@require_auth("secretaria", "director", "supervisor")
def get_concursos(current_user):
    """
    Lista participantes del concurso.
    Acepta ?obra=<id_obra> para filtrar.

    Respuesta item:
    { id, obraId, obraNombre, constructora, rfc, monto, aprobado, razones }
    """
    obra_filter = request.args.get("obra")
    try:
        with get_db() as (conn, cur):
            cur.execute("""
                SELECT
                    TRIM(s.id_participante)   AS id,
                    TRIM(s.id_obra)           AS "obraId",
                    TRIM(o.nombre_obra)       AS "obraNombre",
                    TRIM(s.constructora)      AS constructora,
                    s.rfc,
                    s.monto_propuesta         AS monto,
                    s.aprobado,
                    s.razones_decision        AS razones
                FROM public.opcion_seleccion s
                LEFT JOIN public.obra o ON TRIM(o.id_obra) = TRIM(s.id_obra)
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
    Registra una constructora en el concurso de selección.

    Body JSON:
    {
      "obraId":      "OBRA0000000000000001",   ← FK, viene del select
      "constructora": "Constructora del Norte",
      "rfc":          "CNS020415T34",           ← opcional
      "monto":        985000.00,                ← opcional
      "aprobado":     false,
      "razones":      "No cumple con normas de calidad."
    }

    Validaciones:
      1. La obra debe existir.
      2. Si aprobado = true, no debe existir otro aprobado para esa obra.
         → HTTP 400 con mensaje claro.

    ID generado automáticamente: PART000001, PART000002…

    SQL:
      INSERT INTO public.opcion_seleccion
        (id_participante, id_obra, constructora, rfc,
         monto_propuesta, aprobado, razones_decision)
      VALUES (...)
    """
    body = request.get_json(silent=True) or {}
    valid, err = require_fields(body, "obraId", "constructora", "razones")
    if not valid:
        return err

    obra_id      = body["obraId"].strip()
    constructora = body["constructora"].strip()[:200]
    rfc          = (body.get("rfc") or "").strip().upper() or None
    monto        = body.get("monto") or None
    aprobado     = bool(body.get("aprobado", False))
    razones      = body["razones"].strip()[:500]

    try:
        with get_db() as (conn, cur):

            # ── 1. Verificar que la obra existe ───────────────────
            cur.execute(
                "SELECT 1 FROM public.obra WHERE TRIM(id_obra) = %s", (obra_id,)
            )
            if not cur.fetchone():
                return bad_request(
                    f"La obra '{obra_id}' no existe. Registra la obra primero."
                )

            # ── 2. Validar unicidad del aprobado ──────────────────
            if aprobado:
                cur.execute("""
                    SELECT TRIM(constructora) AS c
                    FROM public.opcion_seleccion
                    WHERE TRIM(id_obra) = %s AND aprobado = true
                    LIMIT 1
                """, (obra_id,))
                ya_existe = cur.fetchone()
                if ya_existe:
                    return bad_request(
                        f"La obra ya tiene una constructora aprobada: "
                        f"'{ya_existe['c']}'. Solo puede haber una ganadora por obra."
                    )

            # ── 3. Generar ID y registrar ─────────────────────────
            new_id = _gen_participante_id(cur)

            cur.execute("""
                INSERT INTO public.opcion_seleccion
                    (id_participante, id_obra, constructora, rfc,
                     monto_propuesta, aprobado, razones_decision)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (
                new_id, obra_id, constructora, rfc,
                float(monto) if monto else None,
                aprobado, razones,
            ))

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
        return ok(message=f"Participante '{row['c']}' eliminado.")
    except Exception as exc:
        return db_error_response(exc)
