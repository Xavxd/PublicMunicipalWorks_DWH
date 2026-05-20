from flask import Blueprint, request
from datetime import datetime, timedelta
from app.database import db
from app.helpers import (
    ok, created, bad_request, not_found,
    db_error_response, require_fields,
)
from app.models import (
    Informe, Obra, Supervisor, Personal
)
from .decorators import require_auth

supervisor_bp = Blueprint("supervisor", __name__)


# ════════════════════════════════════════════════════════════════
#  UTILIDADES DE GENERACIÓN DE IDs
# ════════════════════════════════════════════════════════════════

def _gen_informe_id() -> str:
    """
    Tabla: public.informes
    Columna: id_informe  TEXT
    Formato: INF0000001 … INF9999999 (7 dígitos secuenciales)
    """
    last = Informe.query.order_by(Informe.id_informe.desc()).first()
    if not last:
        num = 1
    else:
        last_id = (last.id_informe or "INF0000000").strip()
        try:
            # Extraer la parte numérica después de "INF"
            num = int(last_id[3:]) + 1
        except ValueError:
            num = Informe.query.count() + 1
    return f"INF{num:07d}"


def _obtener_ultimo_informe(obra_id: str):
    """
    Obtiene el informe más reciente de una obra específica,
    ordenado por año y mes descendentes.
    """
    return (
        Informe.query
        .filter(db.func.trim(Informe.id_obra) == obra_id.strip())
        .order_by(Informe.ano_infor.desc(), Informe.mes.desc())
        .first()
    )


# ════════════════════════════════════════════════════════════════
#  OBRAS ASIGNADAS AL SUPERVISOR
# ════════════════════════════════════════════════════════════════

@supervisor_bp.route("/api/supervisor/obras", methods=["GET"])
@require_auth("supervisor")
def get_supervisor_obras(current_user):
    """
    Lista las obras asignadas al supervisor autenticado.
    Incluye joins a región para datos enriquecidos del frontend.

    Respuesta item:
      {
        "id": "OBRA000...",
        "expediente": "EXP-2026-001",
        "nombre": "Pavimento Hidráulico...",
        "region": "REG001",
        "regionComunidad": "Albarranes",
        "regionBarrio": "Barrio Temeroso",
        "etapa": 1,
        "fechaInicio": "2026-03-01",
        "fechaFin": "2026-09-30"
      }
    """
    try:
        obras = (
            Obra.query
            .filter_by(codigo_supervisor=current_user["id"].strip())
            .order_by(Obra.fecha_inicio.desc())
            .all()
        )

        result = []
        for o in obras:
            result.append({
                "id":              (o.id_obra or "").strip(),
                "expediente":      (o.codigo_expediente or "").strip(),
                "nombre":          (o.nombre_obra or "").strip(),
                "region":          (o.id_region or "").strip(),
                "regionComunidad": (o.region.comunidad or "").strip() if o.region else "",
                "regionBarrio":    (o.region.barrio or "").strip() if o.region else "",
                "etapa":           o.etapa,
                "fechaInicio":     o.fecha_inicio.isoformat() if o.fecha_inicio else None,
                "fechaFin":        o.fecha_final.isoformat() if o.fecha_final else None,
            })

        return ok(result)
    except Exception as exc:
        return db_error_response(exc)


# ════════════════════════════════════════════════════════════════
#  INFORMES — LISTADO (con filtros)
# ════════════════════════════════════════════════════════════════

@supervisor_bp.route("/api/informes", methods=["GET"])
@require_auth("director", "supervisor")
def get_informes(current_user):
    """
    Lista informes con filtros opcionales.

    Query params:
      ?obra=<id_obra>    — filtrar por obra
      ?anio=<año>        — filtrar por año

    Un supervisor solo ve sus propios informes.
    Un director ve todos los informes (puede filtrar por supervisor).

    Respuesta item:
      {
        "id": "INF0000001",
        "obraId": "OBRA000...",
        "obraExpediente": "EXP-2026-001",
        "obraNombre": "Pavimento...",
        "supervisorId": "SUP...",
        "supervisorNombre": "Juan Pérez",
        "anio": 2026,
        "mes": "5",
        "avanceFisico": 45,
        "avanceFinanciero": 38,
        "descripcion": "...",
        "documento": "https://..."
      }
    """
    obra_filter = request.args.get("obra")
    anio_filter = request.args.get("anio")

    # Un supervisor solo ve sus propios informes
    supervisor_id = current_user["id"].strip() \
        if current_user["role"] == "supervisor" else None

    try:
        query = (
            Informe.query
            .join(Obra, Informe.id_obra == Obra.id_obra)
            .join(Supervisor, Informe.codigo_supervisor == Supervisor.codigo_personal)
            .join(Personal, Supervisor.codigo_personal == Personal.codigo_personal)
        )

        # Filtro por supervisor (si es supervisor autenticado)
        if supervisor_id:
            query = query.filter(
                db.func.trim(Informe.codigo_supervisor) == supervisor_id
            )

        # Filtro por obra
        if obra_filter:
            query = query.filter(
                db.func.trim(Informe.id_obra) == obra_filter.strip()
            )

        # Filtro por año
        if anio_filter:
            query = query.filter(Informe.ano_infor == int(anio_filter))

        informes = query.order_by(
            Informe.ano_infor.desc(),
            Informe.mes.asc()
        ).all()

        result = []
        for inf in informes:
            obra = inf.obra
            supervisor_personal = inf.supervisor.personal if inf.supervisor else None

            result.append({
                "id":                 (inf.id_informe or "").strip(),
                "obraId":             (inf.id_obra or "").strip(),
                "obraExpediente":     (obra.codigo_expediente or "").strip() if obra else "",
                "obraNombre":         (obra.nombre_obra or "").strip() if obra else "",
                "supervisorId":       (inf.codigo_supervisor or "").strip(),
                "supervisorNombre":   (
                    f"{supervisor_personal.nombre or ''} "
                    f"{supervisor_personal.apellido_paterno or ''}"
                ).strip() if supervisor_personal else "",
                "anio":               inf.ano_infor,
                "mes":                (inf.mes or "").strip(),
                "avanceFisico":       inf.porcentaje_avance_fisico,
                "avanceFinanciero":   inf.porcentaje_avance_presupuestario,
                "descripcion":        (inf.descripcion or "").strip(),
                "documento":          (inf.doc_infome or "").strip(),
            })

        return ok(result)
    except Exception as exc:
        return db_error_response(exc)


# ════════════════════════════════════════════════════════════════
#  INFORMES — LISTADO AGRUPADO POR OBRA
# ════════════════════════════════════════════════════════════════

@supervisor_bp.route("/api/informes/por-obra", methods=["GET"])
@require_auth("supervisor")
def get_informes_por_obra(current_user):
    """
    Devuelve todos los informes del supervisor autenticado,
    agrupados por obra.

    Respuesta:
      {
        "success": true,
        "data": [
          {
            "obraId": "OBRA000...",
            "obraNombre": "Pavimento Hidráulico...",
            "expediente": "EXP-2026-001",
            "fechaInicio": "2026-03-01",
            "fechaFin": "2026-09-30",
            "regionComunidad": "Albarranes",
            "regionBarrio": "Barrio Temeroso",
            "totalInformes": 3,
            "ultimoAvanceFisico": 45,
            "ultimoAvanceFinanciero": 38,
            "informes": [
              {
                "id": "INF0000001",
                "anio": 2026,
                "mes": "5",
                "avanceFisico": 45,
                "avanceFinanciero": 38,
                "descripcion": "...",
                "documento": "https://..."
              }
            ]
          }
        ]
      }
    """
    try:
        supervisor_id = current_user["id"].strip()

        # Obtener obras asignadas al supervisor
        obras = (
            Obra.query
            .filter_by(codigo_supervisor=supervisor_id)
            .order_by(Obra.fecha_inicio.desc())
            .all()
        )

        result = []
        for obra in obras:
            # Obtener informes de esta obra para este supervisor
            informes = (
                Informe.query
                .filter(
                    db.func.trim(Informe.id_obra) == obra.id_obra.strip(),
                    db.func.trim(Informe.codigo_supervisor) == supervisor_id
                )
                .order_by(Informe.ano_infor.desc(), Informe.mes.desc())
                .all()
            )

            informes_list = []
            for inf in informes:
                informes_list.append({
                    "id":               (inf.id_informe or "").strip(),
                    "anio":             inf.ano_infor,
                    "mes":              (inf.mes or "").strip(),
                    "avanceFisico":     inf.porcentaje_avance_fisico,
                    "avanceFinanciero": inf.porcentaje_avance_presupuestario,
                    "descripcion":      (inf.descripcion or "").strip(),
                    "documento":        (inf.doc_infome or "").strip(),
                })

            # Calcular últimos avances (del informe más reciente)
            ultimo_avance_fisico = informes_list[0]["avanceFisico"] if informes_list else 0
            ultimo_avance_fin = informes_list[0]["avanceFinanciero"] if informes_list else 0

            result.append({
                "obraId":                 (obra.id_obra or "").strip(),
                "obraNombre":             (obra.nombre_obra or "").strip(),
                "expediente":             (obra.codigo_expediente or "").strip(),
                "fechaInicio":            obra.fecha_inicio.isoformat() if obra.fecha_inicio else None,
                "fechaFin":               obra.fecha_final.isoformat() if obra.fecha_final else None,
                "regionComunidad":        (obra.region.comunidad or "").strip() if obra.region else "",
                "regionBarrio":           (obra.region.barrio or "").strip() if obra.region else "",
                "totalInformes":          len(informes_list),
                "ultimoAvanceFisico":     ultimo_avance_fisico,
                "ultimoAvanceFinanciero": ultimo_avance_fin,
                "informes":               informes_list,
            })

        return ok(result)
    except Exception as exc:
        return db_error_response(exc)


# ════════════════════════════════════════════════════════════════
#  INFORMES — CREAR
# ════════════════════════════════════════════════════════════════

@supervisor_bp.route("/api/informes", methods=["POST"])
@require_auth("supervisor")
def create_informe(current_user):
    """
    Registra un nuevo informe mensual de obra.

    Body esperado (coincide con supervisor.js):
    {
      "obraId":            "OBRA000...",
      "anio":              2026,
      "mes":               5,
      "avanceFisico":      45,
      "avanceFinanciero":  38,
      "descripcion":       "Trabajos realizados...",
      "documento":         "https://drive.google.com/..."
    }

    Reglas:
      - El ID se genera automáticamente (INF0000001, INF0000002, ...).
      - El supervisorId se toma del token de autenticación (NO del body).
      - Se valida que el supervisor tenga la obra asignada.
      - Los porcentajes se validan en rango 0-100.
      - No se permite publicar más de 10 días después de la fecha de entrega.
      - Los porcentajes no pueden ser inferiores al informe anterior.

    Respuesta exitosa:
      { "success": true, "data": { "id": "INF0000001" }, "message": "..." }
    """
    body = request.get_json(silent=True) or {}
    valid, err = require_fields(
        body, "obraId", "anio", "mes", "avanceFisico", "avanceFinanciero"
    )
    if not valid:
        return err

    obra_id       = body["obraId"].strip()
    anio          = int(body["anio"])
    mes           = str(body["mes"]).strip()
    avance_fisico = int(body["avanceFisico"])
    avance_fin    = int(body["avanceFinanciero"])
    descripcion   = (body.get("descripcion") or "").strip()
    documento     = (body.get("documento") or "").strip()

    # Validar rangos de porcentajes
    if not (0 <= avance_fisico <= 100):
        return bad_request("El avance físico debe estar entre 0 y 100.")
    if not (0 <= avance_fin <= 100):
        return bad_request("El avance financiero debe estar entre 0 y 100.")

    try:
        # ── 1. Verificar que el supervisor tiene la obra asignada ──
        obra = Obra.query.get(obra_id)
        if not obra:
            return bad_request(f"La obra '{obra_id}' no existe.")

        if obra.codigo_supervisor.strip() != current_user["id"].strip():
            return bad_request(
                "No tienes permiso para reportar en esta obra. "
                "El director debe asignártela primero."
            )

        # ── 2. Validación: no más de 10 días después de fecha de entrega ──
        if obra.fecha_final:
            fecha_limite = obra.fecha_final + timedelta(days=10)
            hoy = datetime.now().date()
            if hoy > fecha_limite:
                return bad_request(
                    "No se puede publicar un informe más de 10 días después "
                    f"de la fecha de entrega de la obra ({obra.fecha_final.isoformat()}). "
                    f"Límite: {fecha_limite.isoformat()}."
                )

        # ── 3. Validación: porcentajes no pueden ser menores al informe anterior ──
        ultimo_informe = _obtener_ultimo_informe(obra_id)
        if ultimo_informe:
            if avance_fisico < ultimo_informe.porcentaje_avance_fisico:
                return bad_request(
                    f"El avance físico ({avance_fisico}%) no puede ser menor al "
                    f"del informe anterior ({ultimo_informe.porcentaje_avance_fisico}%)."
                )
            if avance_fin < ultimo_informe.porcentaje_avance_presupuestario:
                return bad_request(
                    f"El avance financiero ({avance_fin}%) no puede ser menor al "
                    f"del informe anterior ({ultimo_informe.porcentaje_avance_presupuestario}%)."
                )

        # ── 4. Generar ID de informe automáticamente ──
        informe_id = _gen_informe_id()

        # ── 5. INSERT con ORM ──
        nuevo_informe = Informe(
            id_informe=informe_id,
            ano_infor=anio,
            mes=mes.ljust(30),           # CHAR(30) en la BD
            porcentaje_avance_fisico=avance_fisico,
            porcentaje_avance_presupuestario=avance_fin,
            doc_infome=documento,
            descripcion=descripcion,
            id_obra=obra_id,
            codigo_supervisor=current_user["id"].strip(),
        )
        db.session.add(nuevo_informe)
        db.session.commit()

        return created(
            {"id": informe_id},
            f"Informe de {mes.strip()} {anio} registrado exitosamente."
        )

    except Exception as exc:
        db.session.rollback()
        return db_error_response(exc)


# ════════════════════════════════════════════════════════════════
#  INFORMES — DETALLE POR ID
# ════════════════════════════════════════════════════════════════

@supervisor_bp.route("/api/informes", methods=["GET"])
@require_auth("director", "supervisor")
def get_informes(current_user):
    """
    Lista informes con filtros opcionales.
    Si se pasa ?grouped=true, devuelve los informes agrupados por obra.
    """
    obra_filter = request.args.get("obra")
    anio_filter = request.args.get("anio")
    grouped = request.args.get("grouped") == "true"

    supervisor_id = current_user["id"].strip() if current_user["role"] == "supervisor" else None

    try:
        # Si es grouped, devolver agrupado
        if grouped and current_user["role"] == "supervisor":
            # Obtener obras asignadas al supervisor
            obras = Obra.query.filter_by(codigo_supervisor=supervisor_id).order_by(Obra.fecha_inicio.desc()).all()
            result = []
            for obra in obras:
                informes = Informe.query.filter(
                    db.func.trim(Informe.id_obra) == obra.id_obra.strip(),
                    db.func.trim(Informe.codigo_supervisor) == supervisor_id
                ).order_by(Informe.ano_infor.desc(), Informe.mes.desc()).all()

                informes_list = []
                for inf in informes:
                    informes_list.append({
                        "id": (inf.id_informe or "").strip(),
                        "anio": inf.ano_infor,
                        "mes": (inf.mes or "").strip(),
                        "avanceFisico": inf.porcentaje_avance_fisico,
                        "avanceFinanciero": inf.porcentaje_avance_presupuestario,
                        "descripcion": (inf.descripcion or "").strip(),
                        "documento": (inf.doc_infome or "").strip(),
                    })
                ultimo_avance_fisico = informes_list[0]["avanceFisico"] if informes_list else 0
                ultimo_avance_fin = informes_list[0]["avanceFinanciero"] if informes_list else 0
                result.append({
                    "obraId": (obra.id_obra or "").strip(),
                    "obraNombre": (obra.nombre_obra or "").strip(),
                    "expediente": (obra.codigo_expediente or "").strip(),
                    "fechaInicio": obra.fecha_inicio.isoformat() if obra.fecha_inicio else None,
                    "fechaFin": obra.fecha_final.isoformat() if obra.fecha_final else None,
                    "regionComunidad": (obra.region.comunidad or "").strip() if obra.region else "",
                    "regionBarrio": (obra.region.barrio or "").strip() if obra.region else "",
                    "totalInformes": len(informes_list),
                    "ultimoAvanceFisico": ultimo_avance_fisico,
                    "ultimoAvanceFinanciero": ultimo_avance_fin,
                    "informes": informes_list,
                })
            return ok(result)

        # Si no es grouped, comportamiento normal de listado
        query = Informe.query.join(Obra, Informe.id_obra == Obra.id_obra).join(Supervisor, Informe.codigo_supervisor == Supervisor.codigo_personal).join(Personal, Supervisor.codigo_personal == Personal.codigo_personal)
        if supervisor_id:
            query = query.filter(db.func.trim(Informe.codigo_supervisor) == supervisor_id)
        if obra_filter:
            query = query.filter(db.func.trim(Informe.id_obra) == obra_filter.strip())
        if anio_filter:
            query = query.filter(Informe.ano_infor == int(anio_filter))
        informes = query.order_by(Informe.ano_infor.desc(), Informe.mes.asc()).all()

        result = []
        for inf in informes:
            obra = inf.obra
            supervisor_personal = inf.supervisor.personal if inf.supervisor else None
            result.append({
                "id": (inf.id_informe or "").strip(),
                "obraId": (inf.id_obra or "").strip(),
                "obraExpediente": (obra.codigo_expediente or "").strip() if obra else "",
                "obraNombre": (obra.nombre_obra or "").strip() if obra else "",
                "supervisorId": (inf.codigo_supervisor or "").strip(),
                "supervisorNombre": (f"{supervisor_personal.nombre or ''} {supervisor_personal.apellido_paterno or ''}").strip() if supervisor_personal else "",
                "anio": inf.ano_infor,
                "mes": (inf.mes or "").strip(),
                "avanceFisico": inf.porcentaje_avance_fisico,
                "avanceFinanciero": inf.porcentaje_avance_presupuestario,
                "descripcion": (inf.descripcion or "").strip(),
                "documento": (inf.doc_infome or "").strip(),
            })
        return ok(result)
    except Exception as exc:
        return db_error_response(exc)


# ════════════════════════════════════════════════════════════════
#  INFORMES — ELIMINAR
# ════════════════════════════════════════════════════════════════

@supervisor_bp.route("/api/informes/grouped", methods=["GET"])
@require_auth("supervisor", "director")
def delete_informe(informe_id, current_user):
    try:
        # Buscar el informe por ID (trim por compatibilidad con CHAR)
        informe = Informe.query.filter(
            db.func.trim(Informe.id_informe) == informe_id.strip()
        ).first()

        if not informe:
            return not_found(f"Informe '{informe_id}' no encontrado.")

        # Si es supervisor, verificar propiedad
        if current_user["role"] == "supervisor":
            if informe.codigo_supervisor.strip() != current_user["id"].strip():
                return bad_request("Acceso denegado a este informe.")

        db.session.delete(informe)
        db.session.commit()

        return ok(message="Informe eliminado.")

    except Exception as exc:
        db.session.rollback()
        return db_error_response(exc)
