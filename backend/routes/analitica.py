"""
backend/routes/analitica.py
═══════════════════════════════════════════════════════════════
ANALYTICAL ENDPOINTS — the warehouse views over REST
═══════════════════════════════════════════════════════════════

Why this blueprint exists
-------------------------
The chapter states that the analytical views are consumed through the same
REST API as the rest of the system. They were not: every route in this backend
read the operational schema (`public.*`), and nothing anywhere touched
`warehouse.*`. The detection rule reported in the evaluation was likewise only
in a standalone script. A reviewer found both by reading the repository.

These endpoints serve the six warehouse views read-only, including
`v_anomalias_deteccion`, which implements the C1-C3 criteria the chapter
evaluates. With them, the rule reported in the paper and the rule an operator
would actually run are the same object.

Read-only by construction: only GET is registered, and the handlers issue a
single SELECT against a view. There is no path here that writes.
"""

from flask import Blueprint, jsonify, request
from sqlalchemy import text

from app.database import db

analitica_bp = Blueprint("analitica", __name__)

# Las seis vistas del almacén. El diccionario es también la lista blanca: el
# nombre de la vista nunca se toma de la petición, sólo se elige de aquí, de
# modo que no hay forma de que un parámetro llegue a la consulta.
VISTAS = {
    "obras-retraso": ("v_obras_retraso", "works past their planned end date"),
    "alertas": ("v_alertas_auditoria", "audit events classified into alert types"),
    "trazabilidad": ("v_trazabilidad_obra", "full SCD 2 version history per work"),
    "participacion": ("v_participacion_ciudadana", "proposals and votes by region"),
    "presupuesto": ("v_ejercicio_presupuestario", "budget execution by funding source"),
    "anomalias": ("v_anomalias_deteccion", "C1-C3 detection over the monthly fact table"),
}

LIMITE_POR_DEFECTO = 500
LIMITE_MAXIMO = 5000


@analitica_bp.route("/api/analitica/vistas", methods=["GET"])
def listar_vistas():
    """Qué hay disponible, para que el consumidor no tenga que adivinar."""
    return jsonify({
        "success": True,
        "data": [
            {"clave": clave, "vista": f"warehouse.{vista}", "descripcion": desc}
            for clave, (vista, desc) in VISTAS.items()
        ],
    })


@analitica_bp.route("/api/analitica/<clave>", methods=["GET"])
def consultar_vista(clave):
    if clave not in VISTAS:
        return jsonify({
            "success": False,
            "message": f"unknown view '{clave}'",
            "disponibles": sorted(VISTAS),
        }), 404

    vista, _ = VISTAS[clave]
    try:
        limite = min(int(request.args.get("limite", LIMITE_POR_DEFECTO)), LIMITE_MAXIMO)
    except ValueError:
        limite = LIMITE_POR_DEFECTO

    try:
        # El nombre de la vista viene de VISTAS, no de la petición; el límite
        # va como parámetro enlazado.
        resultado = db.session.execute(
            text(f"SELECT * FROM warehouse.{vista} LIMIT :limite"),
            {"limite": limite},
        )
        filas = [dict(fila._mapping) for fila in resultado]
        return jsonify({
            "success": True,
            "vista": f"warehouse.{vista}",
            "total": len(filas),
            "limite": limite,
            "data": filas,
        })
    except Exception as exc:  # noqa: BLE001 — se devuelve el motivo al cliente
        return jsonify({
            "success": False,
            "vista": f"warehouse.{vista}",
            "message": str(exc),
        }), 500
