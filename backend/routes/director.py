from flask import Blueprint, request
from app.database import db
from app.helpers import (
    ok, created, bad_request, not_found,
    db_error_response, require_fields,
)
from app.models import (
    Constructora, Region, Obra, PresupuestoObra,
    FuentePresupuestaria, Financia, Supervisor,
    Proyectista, OpcionSeleccion
)
from .decorators import require_auth

director_bp = Blueprint("director", __name__)


# ════════════════════════════════════════════════════════════════
#  UTILIDADES DE GENERACIÓN DE IDs
# ════════════════════════════════════════════════════════════════

def _gen_constructora_id() -> str:
    """
    Tabla: public.constructora
    Columna: id_constructora  CHAR(10)
    Formato: CONS000001 … CONS999999
    """
    last = Constructora.query.order_by(Constructora.id_constructora.desc()).first()
    if not last:
        num = 1
    else:
        last_id = (last.id_constructora or "CONS000000").strip()
        try:
            num = int(last_id[4:]) + 1        # 'CONS000003' → 3 → 4
        except ValueError:
            num = Constructora.query.count() + 1
    return f"CONS{num:06d}"                  # 'CONS000004' — 10 chars


def _gen_region_id() -> str:
    """
    Tabla: public.region
    Columna: id_region  CHAR(5)
    Formato: R001 … R999
    """
    last = Region.query.order_by(Region.id_region.desc()).first()
    if not last:
        num = 1
    else:
        last_id = (last.id_region or "R000").strip()
        try:
            num = int(last_id[1:]) + 1        # 'R004' → 4 → 5
        except ValueError:
            num = Region.query.count() + 1
    raw = f"R{num:03d}"                      # 'R005' — 4 chars → CHAR(5)
    return raw                                # psycopg2 + Postgres hace el padding de CHAR


def _gen_obra_id() -> str:
    """
    Tabla: public.obra
    Columna: id_obra  CHAR(20)
    Formato: OBRA000000000000001 … (longitud total 20)
    """
    last = Obra.query.order_by(Obra.id_obra.desc()).first()
    if not last:
        num = 1
    else:
        last_id = (last.id_obra or "OBRA" + "0" * 16).strip()
        try:
            num = int(last_id[4:]) + 1       # 'OBRA000000000000001' → 1 → 2
        except ValueError:
            num = Obra.query.count() + 1
    return f"OBRA{num:016d}"                # 20 chars en total


def _gen_presupuesto_id() -> str:
    """
    Tabla: public.presupuesto_obra
    Columna: id_presupuesto  CHAR(10)
    Formato: PRES000001 … PRES999999
    """
    last = PresupuestoObra.query.order_by(PresupuestoObra.id_presupuesto.desc()).first()
    if not last:
        num = 1
    else:
        last_id = (last.id_presupuesto or "PRES000000").strip()
        try:
            num = int(last_id[4:]) + 1
        except ValueError:
            num = PresupuestoObra.query.count() + 1
    return f"PRES{num:06d}"                # 10 chars


def _gen_fuente_id(nivel: str, programa: str) -> str:
    import hashlib
    nivel_up = nivel.strip().upper()
    prog_up  = programa.strip().upper()

    letra  = nivel_up[0] if nivel_up else "O"     # E/M/F/O(tro)
    digest = hashlib.sha1(prog_up.encode()).hexdigest().upper()[:4]

    raw = f"FP{letra}{digest}"                # 'FPE3A7F' — 7 chars
    return raw[:10]                           # CHAR(10) en Supabase


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
        rows = Constructora.query.order_by(Constructora.nombre_const.asc()).all()
        return ok([
            {
                "id":     (r.id_constructora or "").strip(),
                "nombre": (r.nombre_const or "").strip(),
                "rfc":    (r.rfc or "").strip(),
                "tipo":   (r.tipo_ejecutor or "").strip(),
            }
            for r in rows
        ])
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
      "tipo":         "Empresa Externa"
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
    """
    body = request.get_json(silent=True) or {}
    valid, err = require_fields(body, "nombre", "rfc", "tipo")
    if not valid:
        return err

    nombre = body["nombre"].strip()
    rfc    = body["rfc"].strip().upper()
    tipo   = body["tipo"].strip()

    # Validación mínima de RFC mexicano (3–4 letras + 6 dígitos + 3 alfanuméricos)
    import re
    if not re.match(r'^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$', rfc, re.IGNORECASE):
        return bad_request(
            "El RFC no tiene un formato válido. Ejemplo correcto: CVS020415T34"
        )

    try:
        # ── Verificar RFC duplicado ───────────────────────────
        existing = Constructora.query.filter(
            db.func.trim(Constructora.rfc) == rfc
        ).first()

        if existing:
            return ok(
                {
                    "id":     (existing.id_constructora or "").strip(),
                    "nombre": nombre,
                    "rfc":    rfc,
                    "reused": True,
                },
                f"RFC ya registrado. Reutilizando constructora {existing.id_constructora.strip()}."
            )

        # ── Generar ID y registrar ────────────────────────────
        new_id = _gen_constructora_id()

        nueva = Constructora(
            id_constructora=new_id,
            nombre_const=nombre[:150],
            rfc=rfc,
            tipo_ejecutor=tipo[:100]
        )
        db.session.add(nueva)
        db.session.commit()

        return created(
            {"id": new_id, "nombre": nombre, "rfc": rfc},
            f"Constructora registrada: {new_id}"
        )

    except Exception as exc:
        db.session.rollback()
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
        rows = Region.query.order_by(Region.comunidad, Region.barrio).all()
        return ok([
            {
                "id":       (r.id_region or "").strip(),
                "comunidad": (r.comunidad or "").strip(),
                "barrio":   (r.barrio or "").strip(),
                "colonia":  (r.colonia or "").strip() if r.colonia else None,
            }
            for r in rows
        ])
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
    """
    body = request.get_json(silent=True) or {}
    valid, err = require_fields(body, "comunidad", "barrio")
    if not valid:
        return err

    comunidad = body["comunidad"].strip()[:50]
    barrio    = body["barrio"].strip()[:150]
    colonia   = (body.get("colonia") or "").strip() or None

    try:
        # ── Verificar duplicado por comunidad + barrio ────────
        existing = Region.query.filter(
            db.func.lower(db.func.trim(Region.comunidad)) == comunidad.lower(),
            db.func.lower(db.func.trim(Region.barrio))    == barrio.lower()
        ).first()

        if existing:
            return ok(
                {
                    "id":       (existing.id_region or "").strip(),
                    "comunidad": comunidad,
                    "barrio":   barrio,
                    "reused":   True,
                },
                f"Región ya existente. Reutilizando {existing.id_region.strip()}."
            )

        # ── Generar ID y registrar ────────────────────────────
        new_id = _gen_region_id()

        nueva = Region(
            id_region=new_id,
            comunidad=comunidad,
            barrio=barrio,
            colonia=colonia
        )
        db.session.add(nueva)
        db.session.commit()

        return created(
            {"id": new_id, "comunidad": comunidad, "barrio": barrio},
            f"Región registrada: {new_id}"
        )

    except Exception as exc:
        db.session.rollback()
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
        query = Obra.query \
            .outerjoin(Constructora, Obra.id_constructora == Constructora.id_constructora) \
            .outerjoin(Region, Obra.id_region == Region.id_region)

        if q:
            query = query.filter(
                db.or_(
                    db.func.trim(Obra.nombre_obra).ilike(f"%{q}%"),
                    db.func.trim(Obra.codigo_expediente).ilike(f"%{q}%")
                )
            )

        obras = query.order_by(Obra.fecha_inicio.desc().nullslast()).all()

        rows = []
        for o in obras:
            rows.append({
                "id":                 (o.id_obra or "").strip(),
                "expediente":         (o.codigo_expediente or "").strip(),
                "nombre":             (o.nombre_obra or "").strip(),
                "regionComunidad":    (o.region.comunidad or "").strip() if o.region else "",
                "regionBarrio":       (o.region.barrio or "").strip() if o.region else "",
                "constructoraNombre": (o.constructora.nombre_const or "").strip() if o.constructora else "",
                "constructoraTipo":   (o.constructora.tipo_ejecutor or "").strip() if o.constructora else "",
                "fechaInicio":        o.fecha_inicio.isoformat() if o.fecha_inicio else None,
                "fechaFin":           o.fecha_final.isoformat() if o.fecha_final else None,
                "status":             "activa"
            })

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
        # ── 1. Verificar entidades relacionadas ───────────────
        if not Constructora.query.get(constructora_id):
            return bad_request(
                f"La constructora '{constructora_id}' no existe en la base de datos. "
                "Completa el Paso 1 antes de continuar."
            )

        if not Region.query.get(region_id):
            return bad_request(
                f"La región '{region_id}' no existe en la base de datos. "
                "Completa el Paso 2 antes de continuar."
            )

        if not Supervisor.query.get(supervisor_id):
            return bad_request(
                f"El supervisor '{supervisor_id}' no está registrado en el sistema."
            )

        # ── 2. Generar código de expediente ───────────────────
        from datetime import date
        anio = date.today().year

        expedientes = db.session.query(Obra.codigo_expediente).filter(
            Obra.codigo_expediente.like(f"EXP-{anio}-%")
        ).all()

        max_num = 0
        for (exp,) in expedientes:
            try:
                num = int(exp.split('-')[-1])
                if num > max_num:
                    max_num = num
            except (ValueError, IndexError):
                continue

        siguiente_num = max_num + 1
        expediente = f"EXP-{anio}-{siguiente_num:03d}"

        # ── 3. Generar ID de obra ─────────────────────────────
        obra_id = _gen_obra_id()

        # ── 4. INSERT obra ────────────────────────────────────
        nueva_obra = Obra(
            id_obra=obra_id,
            codigo_expediente=expediente,
            nombre_obra=nombre,
            etapa=etapa,
            fecha_inicio=fecha_inicio,
            fecha_final=fecha_fin,
            descripcion=descripcion,
            beneficiarios=beneficiarios,
            id_constructora=constructora_id,
            id_region=region_id,
            codigo_supervisor=supervisor_id,
        )
        db.session.add(nueva_obra)

        # ── 5. INSERT presupuesto_obra ────────────────────────
        # Busca el primer proyectista disponible para asociar el
        # presupuesto inicial.  El director asignará uno formalmente
        # después (flujo del proyectista).
        proy = Proyectista.query.order_by(Proyectista.codigo_personal).first()
        if proy:
            pres_id = _gen_presupuesto_id()
            nuevo_pres = PresupuestoObra(
                id_presupuesto=pres_id,
                presupuesto_total=presupuesto,
                id_proyectista=proy.codigo_personal,
                id_obra=obra_id
            )
            db.session.add(nuevo_pres)

        # ── 6. INSERT financia (una fila por fuente) ──────────
        for fuente_id in fuentes:
            fuente_id = fuente_id.strip()
            if not fuente_id:
                continue
            # Verificar que la fuente existe antes de insertar
            if FuentePresupuestaria.query.get(fuente_id):
                existing_fin = Financia.query.filter_by(
                    id_obra=obra_id, id_fuente=fuente_id
                ).first()
                if not existing_fin:
                    fin = Financia(id_obra=obra_id, id_fuente=fuente_id)
                    db.session.add(fin)

        db.session.commit()

        return created(
            {
                "id":         obra_id,
                "expediente": expediente,
                "nombre":     nombre,
            },
            "Obra registrada exitosamente."
        )

    except Exception as exc:
        db.session.rollback()
        return db_error_response(exc)


@director_bp.route("/api/obras/<obra_id>", methods=["GET"])
@require_auth("director", "supervisor", "proyectista", "secretaria")
def get_obra(obra_id, current_user):
    """Detalle completo de una obra con sus fuentes."""
    try:
        obra = Obra.query \
            .outerjoin(Constructora, Obra.id_constructora == Constructora.id_constructora) \
            .outerjoin(Region, Obra.id_region == Region.id_region) \
            .filter(Obra.id_obra == obra_id.strip()) \
            .first()

        if not obra:
            return not_found("Obra no encontrada.")

        # Fuentes vinculadas
        fuentes = Financia.query \
            .join(FuentePresupuestaria, Financia.id_fuente == FuentePresupuestaria.id_fuente) \
            .filter(Financia.id_obra == obra_id.strip()) \
            .all()

        # Presupuesto
        presupuesto = PresupuestoObra.query.filter_by(id_obra=obra.id_obra).first()

        result = {
            "id":                 (obra.id_obra or "").strip(),
            "expediente":         (obra.codigo_expediente or "").strip(),
            "nombre":             (obra.nombre_obra or "").strip(),
            "etapa":              obra.etapa,
            "fechaInicio":        obra.fecha_inicio.isoformat() if obra.fecha_inicio else None,
            "fechaFin":           obra.fecha_final.isoformat() if obra.fecha_final else None,
            "descripcion":        (obra.descripcion or "").strip(),
            "beneficiarios":      (obra.beneficiarios or "").strip(),
            "constructoraId":     (obra.id_constructora or "").strip(),
            "constructoraNombre": (obra.constructora.nombre_const or "").strip() if obra.constructora else "",
            "regionId":           (obra.id_region or "").strip(),
            "regionComunidad":    (obra.region.comunidad or "").strip() if obra.region else "",
            "regionBarrio":       (obra.region.barrio or "").strip() if obra.region else "",
            "supervisorId":       (obra.codigo_supervisor or "").strip(),
            "presupuesto":        float(presupuesto.presupuesto_total) if presupuesto else 0,
            "status":             "activa",
            "fuentes": [
                {
                    "id":      (f.fuente.id_fuente or "").strip() if f.fuente else (f.id_fuente or "").strip(),
                    "nivel":   (f.fuente.grado_nivel or "").strip().upper() if f.fuente else "",
                    "programa": (f.fuente.programa or "").strip() if f.fuente else "",
                }
                for f in fuentes
            ]
        }

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
        obra = Obra.query.get(obra_id.strip())
        if not obra:
            return not_found(f"La obra '{obra_id}' no existe.")

        nombre = (obra.nombre_obra or "").strip()

        # Eliminar dependencias en orden (FK)
        Financia.query.filter_by(id_obra=obra.id_obra).delete()
        PresupuestoObra.query.filter_by(id_obra=obra.id_obra).delete()

        db.session.delete(obra)
        db.session.commit()

        return ok(message=f"Obra '{nombre}' eliminada correctamente.")

    except Exception as exc:
        db.session.rollback()
        return db_error_response(exc)


# ════════════════════════════════════════════════════════════════
#  SUPERVISORES
# ════════════════════════════════════════════════════════════════

@director_bp.route("/api/supervisores", methods=["GET"])
@require_auth("director", "secretaria")
def get_supervisores(current_user):
    try:

        from app.models import Supervisor, Personal
        from app.database import db
        
        resultados = db.session.query(
            Supervisor.codigo_personal,
            Personal.nombre,
            Personal.apellido_paterno
        ).join(
            Personal, Supervisor.codigo_personal == Personal.codigo_personal
        ).order_by(
            Personal.nombre, Personal.apellido_paterno
        ).all()
        
        data = []
        for codigo, nombre, apellido in resultados:
            data.append({
                "id": (codigo or "").strip(),
                "nombre": (nombre or "").strip(),
                "apellidoPaterno": (apellido or "").strip()
            })
        
        return ok(data)
    except Exception as exc:
        # Imprimir el error real en los logs de Railway
        import traceback
        traceback.print_exc()
        return db_error_response(exc)


# ════════════════════════════════════════════════════════════════
#  FUENTES PRESUPUESTARIAS
# ════════════════════════════════════════════════════════════════

@director_bp.route("/api/fuentes", methods=["GET"])
@require_auth("director", "supervisor", "proyectista", "secretaria")
def get_fuentes(current_user):
    """
    Catálogo de fuentes presupuestarias.
    El JS espera: [ { id, nivel, programa }, … ]
    El campo 'nivel' viaja en MAYÚSCULAS (FEDERAL|ESTATAL|MUNICIPAL|OTRO)
    para que director.js lo use como clase CSS directamente.
    """
    try:
        rows = FuentePresupuestaria.query \
            .order_by(FuentePresupuestaria.grado_nivel.asc(),
                      FuentePresupuestaria.programa.asc()) \
            .all()

        return ok([
            {
                "id":      (r.id_fuente or "").strip(),
                "nivel":   (r.grado_nivel or "").strip().upper(),
                "programa": (r.programa or "").strip(),
            }
            for r in rows
        ])
    except Exception as exc:
        return db_error_response(exc)


@director_bp.route("/api/fuentes", methods=["POST"])
@require_auth("director")
def create_fuente(current_user):
    """
    Registra una nueva fuente presupuestaria.
    Llamado por agregarFuente() en director.js al pulsar el botón "+".

    Body esperado:
    {
      "nivel":    "ESTATAL",
      "programa": "OBRAS DE LA TRANSFORMACIÓN"
    }

    Regla anti-duplicado:
      El ID se genera de forma determinista a partir de nivel+programa
      (ambos normalizados a MAYÚSCULAS).  Si ya existe ese ID en la tabla
      se devuelve el registro existente con "reused": true, y el wizard
      lo toma como si lo hubiera creado — sin duplicar el dato.

    Respuesta exitosa:
    {
      "success": true,
      "data":    { "id": "FPE3A7F", "nivel": "ESTATAL",
                   "programa": "OBRAS DE LA TRANSFORMACIÓN", "reused": false },
      "message": "Fuente registrada."
    }
    """
    body = request.get_json(silent=True) or {}
    valid, err = require_fields(body, "nivel", "programa")
    if not valid:
        return err

    # Normalizar a MAYÚSCULAS antes de procesar
    nivel    = body["nivel"].strip().upper()[:50]
    programa = body["programa"].strip().upper()

    # Validar que el nivel sea uno de los permitidos
    NIVELES_VALIDOS = {"FEDERAL", "ESTATAL", "MUNICIPAL", "OTRO"}
    if nivel not in NIVELES_VALIDOS:
        return bad_request(
            f"Nivel inválido: '{nivel}'. "
            f"Valores permitidos: {', '.join(sorted(NIVELES_VALIDOS))}"
        )

    fuente_id = _gen_fuente_id(nivel, programa)

    try:
        # ── Verificar si ya existe (por ID determinista) ──────
        existing = FuentePresupuestaria.query.get(fuente_id)
        if existing:
            return ok(
                {
                    "id":       fuente_id,
                    "nivel":    nivel,
                    "programa": programa,
                    "reused":   True,
                },
                f"Esta fuente ya está registrada (ID: {fuente_id}). "
                "Se reutiliza el registro existente."
            )

        # ── INSERT ────────────────────────────────────────────
        nueva = FuentePresupuestaria(
            id_fuente=fuente_id,
            grado_nivel=nivel[:50],
            programa=programa
        )
        db.session.add(nueva)
        db.session.commit()

        return created(
            {
                "id":       fuente_id,
                "nivel":    nivel,
                "programa": programa,
                "reused":   False,
            },
            f"Fuente '{programa}' registrada con ID {fuente_id}."
        )

    except Exception as exc:
        db.session.rollback()
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
        query = OpcionSeleccion.query \
            .join(Obra, OpcionSeleccion.id_obra == Obra.id_obra) \
            .order_by(OpcionSeleccion.id_participante.desc())

        if obra_filter:
            query = query.filter(
                db.func.trim(OpcionSeleccion.id_obra) == obra_filter.strip()
            )

        rows = query.all()

        return ok([
            {
                "id":           (r.id_participante or "").strip(),
                "obraId":       (r.id_obra or "").strip(),
                "obraNombre":   (r.obra.nombre_obra or "").strip() if r.obra else "",
                "constructora": (r.constructora or "").strip(),
                "aprobado":     r.aprobado,
                "razones":      (r.razones_decision or "").strip() if r.razones_decision else None,
            }
            for r in rows
        ])
    except Exception as exc:
        return db_error_response(exc)
