"""
backend/routes/public.py
═══════════════════════════════════════════════════════════════
PUBLIC API ENDPOINTS — Smart City Map Module
═══════════════════════════════════════════════════════════════

These are READ-ONLY, UNAUTHENTICATED endpoints designed for the
public-facing Smart City map. They aggregate data from existing
models without requiring any database schema changes.

To integrate:
  1. Copy this file to backend/routes/public.py
  2. Register the blueprint in backend/app/__init__.py

Registration (in app/__init__.py):
     from routes.public import public_bp
     app.register_blueprint(public_bp)

No other changes needed to existing code.
"""

from flask import Blueprint, make_response, jsonify, request
from datetime import datetime, date
from app.database import db
from app.helpers import ok, db_error_response
from app.models import Obra, Region, Constructora, PresupuestoObra, Informe, Supervisor, Personal

public_bp = Blueprint("public", __name__)


# ═══════════════════════════════════════════════════════════════
#  CORS HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════

def _add_cors_headers(response):
    """Add CORS headers to a response."""
    response.headers.add("Access-Control-Allow-Origin", "*")
    response.headers.add("Access-Control-Allow-Headers", "Content-Type, Authorization")
    response.headers.add("Access-Control-Allow-Methods", "GET, OPTIONS")
    return response


def _cors_preflight_response():
    """Return an empty response with CORS headers for OPTIONS requests."""
    response = make_response()
    return _add_cors_headers(response)


# ═══════════════════════════════════════════════════════════════
#  STATUS DERIVATION LOGIC
# ═══════════════════════════════════════════════════════════════

def _derive_obra_status(obra: Obra, latest_avance_fisico: int) -> str:
    """
    Derive obra status from available data.

    The obra table has no explicit status field. We determine status by
    comparing the latest physical progress against the deadline:

    - COMPLETADA: avance_fisico >= 95% OR (fecha_final passed AND avance >= 90%)
    - RETRASADA:  fecha_final has passed AND avance_fisico < 90%
    - EN_PROGRESO: Everything else (within timeline or reasonable progress)
    """
    today = date.today()
    fecha_fin = obra.fecha_final

    if latest_avance_fisico >= 95:
        return "completada"

    if fecha_fin and fecha_fin < today:
        # Deadline has passed
        if latest_avance_fisico >= 90:
            return "completada"
        else:
            return "retrasada"

    return "en_progreso"


def _get_latest_informe_data(obra_id: str) -> dict:
    """Get the latest informe for an obra, returning avance data."""
    try:
        latest = (
            Informe.query
            .filter(db.func.trim(Informe.id_obra) == obra_id.strip())
            .order_by(Informe.ano_infor.desc(), Informe.mes.desc())
            .first()
        )
        if latest:
            return {
                "avance_fisico": latest.porcentaje_avance_fisico or 0,
                "avance_financiero": latest.porcentaje_avance_presupuestario or 0,
                "total_informes": Informe.query.filter(
                    db.func.trim(Informe.id_obra) == obra_id.strip()
                ).count(),
            }
    except Exception:
        pass

    return {"avance_fisico": 0, "avance_financiero": 0, "total_informes": 0}


# ═══════════════════════════════════════════════════════════════
#  PUBLIC ENDPOINTS
# ═══════════════════════════════════════════════════════════════

@public_bp.route("/api/public/obras", methods=["GET", "OPTIONS"])
def get_public_obras():
    """
    Public endpoint: returns all obras with enriched data.
    No authentication required.
    """
    if request.method == "OPTIONS":
        return _cors_preflight_response()

    try:
        obras = Obra.query.all()
        result = []

        for obra in obras:
            # Get related data
            informe_data = _get_latest_informe_data(obra.id_obra)

            # Get presupuesto
            presupuesto = PresupuestoObra.query.filter_by(id_obra=obra.id_obra).first()
            presupuesto_total = float(presupuesto.presupuesto_total) if presupuesto else 0

            # Get supervisor name
            supervisor_nombre = ""
            if obra.supervisor and obra.supervisor.personal:
                s = obra.supervisor.personal
                supervisor_nombre = f"{(s.nombre or '').strip()} {(s.apellido_paterno or '').strip()}".strip()

            # Derive status
            status = _derive_obra_status(obra, informe_data["avance_fisico"])

            result.append({
                "id": (obra.id_obra or "").strip(),
                "expediente": (obra.codigo_expediente or "").strip(),
                "nombre": (obra.nombre_obra or "").strip(),
                "descripcion": (obra.descripcion or "").strip(),
                "beneficiarios": (obra.beneficiarios or "").strip(),
                "fechaInicio": obra.fecha_inicio.isoformat() if obra.fecha_inicio else None,
                "fechaFin": obra.fecha_final.isoformat() if obra.fecha_final else None,
                "status": status,
                "avanceFisico": informe_data["avance_fisico"],
                "avanceFinanciero": informe_data["avance_financiero"],
                "presupuestoTotal": presupuesto_total,
                "regionId": (obra.id_region or "").strip(),
                "regionComunidad": (obra.region.comunidad or "").strip() if obra.region else "",
                "regionBarrio": (obra.region.barrio or "").strip() if obra.region else "",
                "constructoraNombre": (obra.constructora.nombre_const or "").strip() if obra.constructora else "",
                "constructoraTipo": (obra.constructora.tipo_ejecutor or "").strip() if obra.constructora else "",
                "supervisorNombre": supervisor_nombre,
                "totalInformes": informe_data["total_informes"],
            })

        return _add_cors_headers(ok(result))
    except Exception as exc:
        return _add_cors_headers(db_error_response(exc))


@public_bp.route("/api/public/regiones", methods=["GET", "OPTIONS"])
def get_public_regiones():
    """
    Public endpoint: returns all regions.
    No authentication required.
    """
    if request.method == "OPTIONS":
        return _cors_preflight_response()

    try:
        rows = Region.query.order_by(Region.comunidad, Region.barrio).all()
        return _add_cors_headers(ok([
            {
                "id": (r.id_region or "").strip(),
                "comunidad": (r.comunidad or "").strip(),
                "barrio": (r.barrio or "").strip(),
                "colonia": (r.colonia or "").strip() if r.colonia else None,
            }
            for r in rows
        ]))
    except Exception as exc:
        return _add_cors_headers(db_error_response(exc))


@public_bp.route("/api/public/resumen", methods=["GET", "OPTIONS"])
def get_public_resumen():
    """
    Public endpoint: returns aggregated KPI data.
    No authentication required.
    """
    if request.method == "OPTIONS":
        return _cors_preflight_response()

    try:
        obras = Obra.query.all()

        # Collect obra data
        obra_data_list = []
        region_budget_map = {}
        status_counts = {"completada": 0, "en_progreso": 0, "retrasada": 0}
        const_counts = {}
        total_budget = 0
        total_avance = 0
        total_duracion = 0
        communities = set()

        for obra in obras:
            informe_data = _get_latest_informe_data(obra.id_obra)
            presupuesto = PresupuestoObra.query.filter_by(id_obra=obra.id_obra).first()
            presupuesto_total = float(presupuesto.presupuesto_total) if presupuesto else 0
            status = _derive_obra_status(obra, informe_data["avance_fisico"])

            comunidad = (obra.region.comunidad or "").strip() if obra.region else ""
            communities.add(comunidad)

            obra_data_list.append({
                "obra": obra,
                "status": status,
                "avance_fisico": informe_data["avance_fisico"],
                "presupuesto_total": presupuesto_total,
                "comunidad": comunidad,
            })

            status_counts[status] = status_counts.get(status, 0) + 1
            total_budget += presupuesto_total
            total_avance += informe_data["avance_fisico"]

            # Region budget
            if comunidad:
                region_id = (obra.id_region or comunidad).strip()
                if region_id in region_budget_map:
                    region_budget_map[region_id]["total"] += presupuesto_total
                else:
                    region_budget_map[region_id] = {
                        "region": region_id,
                        "comunidad": comunidad,
                        "total": presupuesto_total,
                    }

            # Constructora count
            const_name = (obra.constructora.nombre_const or "").strip() if obra.constructora else ""
            if const_name:
                const_counts[const_name] = const_counts.get(const_name, 0) + 1

            # Duration
            if obra.fecha_inicio and obra.fecha_final:
                dias = (obra.fecha_final - obra.fecha_inicio).days
                if dias > 0:
                    total_duracion += dias

        # Recent obras
        recent = sorted(
            obra_data_list,
            key=lambda x: x["obra"].fecha_inicio or date.min,
            reverse=True,
        )[:8]

        result = {
            "obrasActivas": len(obras),
            "obrasCompletadas": status_counts["completada"],
            "obrasRetrasadas": status_counts["retrasada"],
            "inversionTotal": total_budget,
            "avancePromedio": round(total_avance / len(obras)) if obras else 0,
            "comunidadesImpactadas": len(communities),
            "presupuestoPorRegion": list(region_budget_map.values()),
            "obrasPorStatus": [
                {"status": k, "count": v} for k, v in status_counts.items() if v > 0
            ],
            "obrasRecientes": [
                {
                    "id": (o["obra"].id_obra or "").strip(),
                    "nombre": (o["obra"].nombre_obra or "").strip(),
                    "fechaInicio": o["obra"].fecha_inicio.isoformat() if o["obra"].fecha_inicio else None,
                    "status": o["status"],
                    "avanceFisico": o["avance_fisico"],
                }
                for o in recent
            ],
            "promedioDuracionDias": round(total_duracion / len(obras)) if obras else 0,
            "topConstructoras": sorted(
                [{"nombre": k, "obrasCount": v} for k, v in const_counts.items()],
                key=lambda x: x["obrasCount"],
                reverse=True,
            )[:5],
        }

        return _add_cors_headers(ok(result))
    except Exception as exc:
        return _add_cors_headers(db_error_response(exc))
