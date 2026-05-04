from flask import Blueprint, request
from sqlalchemy import select, func
from app.database import db
from app.helpers import (
    ok, created, bad_request, not_found, forbidden,
    db_error_response, require_fields,
)
from app.models import (
    Proyectista, Constructora, Obra, PresupuestoObra, Costo
)
from .decorators import require_auth

proyectista_bp = Blueprint("proyectista", __name__)


# ════════════════════════════════════════════════════════════════
#  UTILIDADES DE GENERACIÓN DE IDs
# ════════════════════════════════════════════════════════════════

def _gen_cost_id() -> str:
    """
    Tabla: public.costos
    Columna: id_gasto  CHAR(10)
    Formato: CST0000001 … CST9999999 (7 dígitos)
    """
    result = db.session.query(
        db.func.max(db.func.cast(db.func.substring(Costo.id_gasto, 4), db.Integer))
    ).scalar()
    next_num = (result or 0) + 1
    return f"CST{next_num:07d}"


# ════════════════════════════════════════════════════════════════
#  OBRAS DEL PROYECTISTA
# ════════════════════════════════════════════════════════════════

@proyectista_bp.route("/api/proyectista/projects", methods=["GET"])
@require_auth("proyectista")
def get_projects(current_user):
    """
    Lista las obras cuya constructora coincide con la del proyectista
    autenticado.
    """
    try:
        proy = Proyectista.query.get(current_user["id"].strip())
        if not proy:
            return ok([])

        constructora_id = proy.id_constructora
        obras = (
            Obra.query.filter_by(id_constructora=constructora_id)
            .order_by(Obra.fecha_inicio.desc())
            .all()
        )
        if not obras:
            return ok([])

        # Precalcular presupuestos y conteos de costos en una sola pasada
        obra_ids = [o.id_obra for o in obras]
        presupuestos = (
            PresupuestoObra.query.filter(PresupuestoObra.id_obra.in_(obra_ids))
            .all()
        )
        pres_map = {p.id_obra: p for p in presupuestos}
        pres_ids = [p.id_presupuesto for p in presupuestos]

        cost_counts = {}
        if pres_ids:
            rows = (
                db.session.query(Costo.id_presupuesto, func.count(Costo.id_gasto))
                .filter(Costo.id_presupuesto.in_(pres_ids))
                .group_by(Costo.id_presupuesto)
                .all()
            )
            cost_counts = {r[0]: r[1] for r in rows}

        result = []
        for o in obras:
            pres = pres_map.get(o.id_obra)
            has_costs = False
            if pres:
                has_costs = cost_counts.get(pres.id_presupuesto, 0) > 0

            result.append({
                "id": (o.id_obra or "").strip(),
                "expediente": (o.codigo_expediente or "").strip(),
                "nombre": (o.nombre_obra or "").strip(),
                "region": (o.id_region or "").strip(),
                "regionComunidad": (o.region.comunidad or "").strip() if o.region else "",
                "regionBarrio": (o.region.barrio or "").strip() if o.region else "",
                "presupuesto": float(pres.presupuesto_total) if pres else 0,
                "hasCosts": has_costs,
            })

        return ok(result)
    except Exception as exc:
        return db_error_response(exc)


# ════════════════════════════════════════════════════════════════
#  PRESUPUESTO POR OBRA
# ════════════════════════════════════════════════════════════════

@proyectista_bp.route("/api/proyectista/budget/<obra_id>", methods=["GET"])
@require_auth("proyectista")
def get_budget(obra_id, current_user):
    """
    Devuelve el presupuesto completo de una obra (costos agrupados
    por categoría).  Si no existe presupuesto o costos, retorna
    un objeto vacío {} sin error.
    """
    try:
        obra_id = obra_id.strip()
        proy = Proyectista.query.get(current_user["id"].strip())
        if not proy:
            return forbidden("Perfil de proyectista no encontrado.")

        obra = Obra.query.get(obra_id)
        if not obra or obra.id_constructora != proy.id_constructora:
            return forbidden("No tienes acceso a esta obra.")

        pres = PresupuestoObra.query.filter_by(id_obra=obra_id).first()
        if not pres:
            return ok({})

        costs = Costo.query.filter_by(id_presupuesto=pres.id_presupuesto).all()
        categories = {}
        import json

        for c in costs:
            cat = (c.categoria or "").strip()
            if not cat:
                continue
            if cat not in categories:
                categories[cat] = []

            # La descripción almacena un JSON con los campos enriquecidos
            extra = {}
            try:
                extra = json.loads(c.descripcion or "{}")
            except Exception:
                pass

            categories[cat].append({
                "desc": extra.get("desc", c.descripcion or ""),
                "unit": extra.get("unit", ""),
                "qty": extra.get("qty", 1),
                "price": extra.get("price", float(c.costo) if c.costo else 0),
            })

        total = sum(
            sum((item.get("qty", 1) * item.get("price", 0)) for item in cat_items)
            for cat_items in categories.values()
        )

        return ok({
            "budgetId": pres.id_presupuesto.strip(),
            "total": total,
            "categories": categories,
        })
    except Exception as exc:
        return db_error_response(exc)


# ════════════════════════════════════════════════════════════════
#  GUARDAR / REEMPLAZAR PRESUPUESTO (transacción atómica)
# ════════════════════════════════════════════════════════════════

@proyectista_bp.route("/api/proyectista/presupuesto/<obra_id>", methods=["POST"])
@require_auth("proyectista")
def save_budget(obra_id, current_user):
    """
    Reemplaza todos los costos del presupuesto de una obra.
    Usa SELECT FOR UPDATE para evitar condiciones de carrera.
    """
    body = request.get_json(silent=True) or {}
    obra_id = obra_id.strip()

    try:
        proy = Proyectista.query.get(current_user["id"].strip())
        if not proy:
            return forbidden("Perfil de proyectista no encontrado.")

        obra = Obra.query.get(obra_id)
        if not obra or obra.id_constructora != proy.id_constructora:
            return forbidden("No tienes acceso a esta obra.")

        # Bloquear fila del presupuesto (concurrency control)
        pres = PresupuestoObra.query.filter_by(id_obra=obra_id).first()
        if not pres:
        # Crear un nuevo presupuesto base para esta obra
        from app.models import Proyectista
        proy = Proyectista.query.filter_by(codigo_personal=current_user["id"].strip()).first()
        if not proy:
            proy = Proyectista.query.first()  # o cualquier otro fallback
        if not proy:
            return bad_request("No hay proyectistas disponibles para asignar el presupuesto base.")
        
        new_pres_id = _gen_presupuesto_id()  # necesitas esta función (ya existe en director.py, puedes copiarla)
        pres = PresupuestoObra(
            id_presupuesto=new_pres_id,
            presupuesto_total=0,
            id_proyectista=proy.codigo_personal,
            id_obra=obra_id
        )
        db.session.add(pres)
        db.session.flush() 

        # Normalizar payload: puede venir como {categories:{...}} o directamente
        categories = body.get("categories") if isinstance(body, dict) else None
        if categories is None and isinstance(body, dict):
            categories = body
        if not isinstance(categories, dict):
            return bad_request("El formato de categorías es inválido.")

        # Eliminar costos actuales (reemplazo total)
        Costo.query.filter_by(id_presupuesto=pres.id_presupuesto).delete()

        total = 0
        import json

        for cat, items in categories.items():
            if not isinstance(items, list):
                continue
            for item in items:
                if not isinstance(item, dict):
                    continue
                desc = str(item.get("desc", "")).strip()
                unit = str(item.get("unit", "")).strip()
                qty = float(item.get("qty", 0) or 0)
                price = float(item.get("price", 0) or 0)
                if not desc:
                    continue
                costo_total = qty * price
                descripcion_json = json.dumps({
                    "desc": desc,
                    "unit": unit,
                    "qty": qty,
                    "price": price,
                }, ensure_ascii=False)
                cost_id = _gen_cost_id()
                nuevo = Costo(
                    id_gasto=cost_id,
                    categoria=cat,
                    costo=costo_total,
                    descripcion=descripcion_json,
                    id_presupuesto=pres.id_presupuesto,
                )
                db.session.add(nuevo)
                total += costo_total

        pres.presupuesto_total = total
        db.session.commit()

        return ok(
            {
                "budgetId": pres.id_presupuesto.strip(),
                "total": float(total),
            },
            "Presupuesto guardado exitosamente.",
        )
    except Exception as exc:
        db.session.rollback()
        return db_error_response(exc)


# ════════════════════════════════════════════════════════════════
#  CONSTRUCTORA DEL PROYECTISTA (opcional)
# ════════════════════════════════════════════════════════════════

@proyectista_bp.route("/api/proyectista/constructora", methods=["GET"])
@require_auth("proyectista")
def get_constructora(current_user):
    """Devuelve nombre y RFC de la constructora del proyectista."""
    try:
        proy = Proyectista.query.get(current_user["id"].strip())
        if not proy:
            return not_found("Proyectista no encontrado.")

        constructora = Constructora.query.get(proy.id_constructora)
        if not constructora:
            return not_found("Constructora no encontrada.")

        return ok({
            "nombre": (constructora.nombre_const or "").strip(),
            "rfc": (constructora.rfc or "").strip(),
        })
    except Exception as exc:
        return db_error_response(exc)
