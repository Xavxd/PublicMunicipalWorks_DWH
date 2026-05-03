from flask import Blueprint, request
from app.database import db
from app.helpers import (
    ok, created, bad_request, not_found, db_error_response, require_fields,
)
from app.models import (
    Personal, Proyectista, Supervisor, Constructora,
    Obra, Permiso, ActaEntrega, Firmante, OpcionSeleccion
)
from .decorators import require_auth

secretaria_bp = Blueprint("secretaria", __name__)


# ════════════════════════════════════════════════════════════════
#  UTILIDADES DE GENERACIÓN DE IDs
# ════════════════════════════════════════════════════════════════

def _gen_oficio_id() -> str:
    """
    Tabla: public.permisos
    Columna: id_oficio  CHAR(20)
    Formato: OFI + 17 dígitos
    """
    last = Permiso.query.order_by(Permiso.id_oficio.desc()).first()
    if not last:
        num = 1
    else:
        last_id = (last.id_oficio or "OFI" + "0" * 17).strip()
        try:
            num = int(last_id[3:]) + 1
        except ValueError:
            num = Permiso.query.count() + 1
    return f"OFI{num:017d}"


def _gen_acta_id() -> str:
    """
    Tabla: public.acta_entrega
    Columna: id_acta  CHAR(10)
    Formato: ACT + 7 dígitos
    """
    last = ActaEntrega.query.order_by(ActaEntrega.id_acta.desc()).first()
    if not last:
        num = 1
    else:
        last_id = (last.id_acta or "ACT0000000").strip()
        try:
            num = int(last_id[3:]) + 1
        except ValueError:
            num = ActaEntrega.query.count() + 1
    return f"ACT{num:07d}"


def _gen_firmante_id() -> str:
    """
    Tabla: public.firmantes
    Columna: id_firmante  CHAR(10)
    Formato: FRM + 7 dígitos
    """
    last = Firmante.query.order_by(Firmante.id_firmante.desc()).first()
    if not last:
        num = 1
    else:
        last_id = (last.id_firmante or "FRM0000000").strip()
        try:
            num = int(last_id[3:]) + 1
        except ValueError:
            num = Firmante.query.count() + 1
    return f"FRM{num:07d}"


def _gen_participante_id() -> str:
    """
    Tabla: public.opcion_seleccion
    Columna: id_participante  CHAR(10)
    Formato: PART + 6 dígitos
    """
    last = OpcionSeleccion.query.order_by(
        OpcionSeleccion.id_participante.desc()
    ).first()
    if not last:
        num = 1
    else:
        last_id = (last.id_participante or "PART000000").strip()
        try:
            num = int(last_id[4:]) + 1
        except ValueError:
            num = OpcionSeleccion.query.count() + 1
    return f"PART{num:06d}"


def _gen_personal_id(role: str) -> str:
    """
    Tabla: public.personal
    Columna: codigo_personal TEXT (PK)
    Formato por rol:
        Supervisor  → SUP-001
        Proyectista → PROY-001
        Director    → DIR-001
        Secretario  → SEC-001
    """
    prefix = {
        "Supervisor": "SUP",
        "Proyectista": "PROY",
        "Director": "DIR",
        "Secretario": "SEC",
    }.get(role, "PER")

    last = (
        Personal.query.filter(Personal.codigo_personal.like(f"{prefix}-%"))
        .order_by(Personal.codigo_personal.desc())
        .first()
    )
    if not last:
        num = 1
    else:
        last_id = (last.codigo_personal or f"{prefix}-000").strip()
        try:
            num = int(last_id.split("-")[1]) + 1
        except (ValueError, IndexError):
            num = Personal.query.filter(Personal.rol == role).count() + 1
    return f"{prefix}-{num:03d}"


# ════════════════════════════════════════════════════════════════
#  PERMISOS  (ORM)
#  Tabla: public.permisos
# ════════════════════════════════════════════════════════════════

@secretaria_bp.route("/api/permisos", methods=["GET"])
@require_auth("secretaria", "director")
def get_permisos(current_user):
    try:
        rows = (
            Permiso.query.outerjoin(Obra, Permiso.id_obra == Obra.id_obra)
            .order_by(Permiso.id_oficio.desc())
            .all()
        )
        return ok(
            [
                {
                    "id": (p.id_oficio or "").strip(),
                    "obraId": (p.id_obra or "").strip(),
                    "obraNombre": (p.obra.nombre_obra or "").strip()
                    if p.obra
                    else "",
                    "instancia": (p.nombre_instancia or "").strip(),
                    "oficio": (p.oficio_acreditacion or "").strip(),
                }
                for p in rows
            ]
        )
    except Exception as exc:
        return db_error_response(exc)


@secretaria_bp.route("/api/permisos", methods=["POST"])
@require_auth("secretaria")
def create_permiso(current_user):
    body = request.get_json(silent=True) or {}
    valid, err = require_fields(body, "obraId", "instancia", "oficio")
    if not valid:
        return err

    obra_id = body["obraId"].strip()
    instancia = body["instancia"].strip()[:200]
    oficio = body["oficio"].strip()

    try:
        obra = Obra.query.get(obra_id)
        if not obra:
            return bad_request(f"La obra '{obra_id}' no existe.")

        new_id = _gen_oficio_id()
        nuevo = Permiso(
            id_oficio=new_id,
            nombre_instancia=instancia,
            oficio_acreditacion=oficio,
            id_obra=obra_id,
        )
        db.session.add(nuevo)
        db.session.commit()

        return created({"id": new_id}, f"Permiso {new_id} registrado.")
    except Exception as exc:
        db.session.rollback()
        return db_error_response(exc)


@secretaria_bp.route("/api/permisos/<oficio_id>", methods=["DELETE"])
@require_auth("secretaria")
def delete_permiso(oficio_id, current_user):
    try:
        perm = Permiso.query.get(oficio_id.strip())
        if not perm:
            return not_found("Permiso no encontrado.")

        db.session.delete(perm)
        db.session.commit()
        return ok(message="Permiso eliminado.")
    except Exception as exc:
        db.session.rollback()
        return db_error_response(exc)


# ════════════════════════════════════════════════════════════════
#  ACTAS DE ENTREGA  (ORM)
#  Tabla: public.acta_entrega  +  hija public.firmantes
# ════════════════════════════════════════════════════════════════

@secretaria_bp.route("/api/actas", methods=["GET"])
@require_auth("secretaria", "director")
def get_actas(current_user):
    obra_filter = request.args.get("obra")
    try:
        query = ActaEntrega.query.outerjoin(
            Obra, ActaEntrega.id_obra == Obra.id_obra
        )
        if obra_filter:
            query = query.filter(
                db.func.trim(ActaEntrega.id_obra) == obra_filter.strip()
            )
        actas = query.order_by(ActaEntrega.fecha_expedicion.desc()).all()

        data = []
        for a in actas:
            acta_dict = {
                "id": (a.id_acta or "").strip(),
                "obraId": (a.id_obra or "").strip(),
                "obraNombre": (a.obra.nombre_obra or "").strip()
                if a.obra
                else "",
                "contenido": (a.acta_entrega or "").strip(),
                "fecha": a.fecha_expedicion.isoformat()
                if a.fecha_expedicion
                else None,
            }
            # Firmantes
            firmantes = (
                Firmante.query.filter_by(id_acta=a.id_acta)
                .order_by(Firmante.id_firmante)
                .all()
            )
            acta_dict["firmantes"] = [
                {
                    "cargo": (f.cargo or "").strip(),
                    "nombre": (f.nombre or "").strip(),
                    "apellidoP": (f.apellido_paterno or "").strip(),
                    "apellidoM": (f.apellido_materno or "").strip()
                    if f.apellido_materno
                    else "",
                }
                for f in firmantes
            ]
            data.append(acta_dict)

        return ok(data)
    except Exception as exc:
        return db_error_response(exc)


@secretaria_bp.route("/api/actas", methods=["POST"])
@require_auth("secretaria")
def create_acta(current_user):
    body = request.get_json(silent=True) or {}
    valid, err = require_fields(body, "obraId", "fecha")
    if not valid:
        return err

    obra_id = body["obraId"].strip()
    fecha = body["fecha"]
    contenido = (body.get("contenido") or "").strip() or "Acta de entrega."
    firmantes = body.get("firmantes") or []

    completos = [
        f
        for f in firmantes
        if (f.get("nombre") or "").strip() and (f.get("apellidoP") or "").strip()
    ]
    if len(completos) < 3:
        return bad_request(
            "Se requieren al menos 3 firmantes con nombre y apellido paterno."
        )

    try:
        obra = Obra.query.get(obra_id)
        if not obra:
            return bad_request(f"La obra '{obra_id}' no existe.")

        # Verificar unicidad: una sola acta por obra
        existing = ActaEntrega.query.filter(
            db.func.trim(ActaEntrega.id_obra) == obra_id
        ).first()
        if existing:
            return bad_request(
                f"Esta obra ya tiene un Acta de Entrega registrada "
                f"(ID: {existing.id_acta.strip()}). Solo puede haber una acta por obra."
            )

        acta_id = _gen_acta_id()
        nueva_acta = ActaEntrega(
            id_acta=acta_id,
            acta_entrega=contenido,
            fecha_expedicion=fecha,
            id_obra=obra_id,
        )
        db.session.add(nueva_acta)

        for f in completos:
            firm_id = _gen_firmante_id()
            nuevo_firm = Firmante(
                id_firmante=firm_id,
                nombre=f["nombre"].strip()[:100],
                apellido_paterno=f["apellidoP"].strip()[:200],
                apellido_materno=(f.get("apellidoM") or "").strip()[:200]
                or None,
                cargo=(f.get("cargo") or "").strip()[:100],
                id_acta=acta_id,
            )
            db.session.add(nuevo_firm)

        db.session.commit()
        return created(
            {"id": acta_id, "firmantes": len(completos)},
            f"Acta {acta_id} registrada con {len(completos)} firmantes.",
        )
    except Exception as exc:
        db.session.rollback()
        return db_error_response(exc)


@secretaria_bp.route("/api/actas/<acta_id>", methods=["DELETE"])
@require_auth("secretaria")
def delete_acta(acta_id, current_user):
    try:
        acta = ActaEntrega.query.get(acta_id.strip())
        if not acta:
            return not_found("Acta no encontrada.")

        # Los firmantes se eliminan por CASCADE (rel_acta ON DELETE CASCADE)
        db.session.delete(acta)
        db.session.commit()
        return ok(message="Acta eliminada.")
    except Exception as exc:
        db.session.rollback()
        return db_error_response(exc)


# ════════════════════════════════════════════════════════════════
#  CONCURSO DE SELECCIÓN  (ORM)
#  Tabla: public.opcion_seleccion
# ════════════════════════════════════════════════════════════════

@secretaria_bp.route("/api/concursos", methods=["GET"])
@require_auth("secretaria", "director", "supervisor")
def get_concursos(current_user):
    obra_filter = request.args.get("obra")
    try:
        query = (
            OpcionSeleccion.query.join(Obra, OpcionSeleccion.id_obra == Obra.id_obra)
            .order_by(OpcionSeleccion.aprobado.desc(), OpcionSeleccion.id_participante.desc())
        )
        if obra_filter:
            query = query.filter(
                db.func.trim(OpcionSeleccion.id_obra) == obra_filter.strip()
            )
        rows = query.all()

        return ok(
            [
                {
                    "id": (r.id_participante or "").strip(),
                    "obraId": (r.id_obra or "").strip(),
                    "obraNombre": (r.obra.nombre_obra or "").strip()
                    if r.obra
                    else "",
                    "constructora": (r.constructora or "").strip(),
                    "aprobado": r.aprobado,
                    "razones": (r.razones_decision or "").strip()
                    if r.razones_decision
                    else None,
                }
                for r in rows
            ]
        )
    except Exception as exc:
        return db_error_response(exc)


@secretaria_bp.route("/api/concursos", methods=["POST"])
@require_auth("secretaria")
def create_concurso(current_user):
    body = request.get_json(silent=True) or {}
    valid, err = require_fields(body, "obraId", "constructora", "razones")
    if not valid:
        return err

    obra_id = body["obraId"].strip()
    constructora = body["constructora"].strip()[:200]
    aprobado = bool(body.get("aprobado", False))
    razones = body["razones"].strip()

    try:
        obra = Obra.query.get(obra_id)
        if not obra:
            return bad_request(
                f"La obra '{obra_id}' no existe. Regístrala primero."
            )

        if aprobado:
            ya = (
                OpcionSeleccion.query.filter(
                    db.func.trim(OpcionSeleccion.id_obra) == obra_id,
                    OpcionSeleccion.aprobado == True,
                )
                .first()
            )
            if ya:
                return bad_request(
                    f"La obra ya tiene una constructora aprobada: "
                    f"'{ya.constructora.strip()}'. Solo puede haber una ganadora."
                )

        new_id = _gen_participante_id()
        nuevo = OpcionSeleccion(
            id_participante=new_id,
            constructora=constructora,
            aprobado=aprobado,
            razones_decision=razones,
            id_obra=obra_id,
        )
        db.session.add(nuevo)
        db.session.commit()

        return created(
            {"id": new_id, "constructora": constructora, "aprobado": aprobado},
            f"Participante '{constructora}' registrado: {new_id}.",
        )
    except Exception as exc:
        db.session.rollback()
        return db_error_response(exc)


@secretaria_bp.route("/api/concursos/<participante_id>", methods=["DELETE"])
@require_auth("secretaria")
def delete_concurso(participante_id, current_user):
    try:
        part = OpcionSeleccion.query.get(participante_id.strip())
        if not part:
            return not_found("Participante no encontrado.")

        nombre = (part.constructora or "").strip()
        db.session.delete(part)
        db.session.commit()
        return ok(message=f"Participante '{nombre}' eliminado.")
    except Exception as exc:
        db.session.rollback()
        return db_error_response(exc)


# ════════════════════════════════════════════════════════════════
#  PERSONAL  (nuevo — registro de staff)
#  Tabla: public.personal  +  subtipos proyectista / supervisor
# ════════════════════════════════════════════════════════════════

@secretaria_bp.route("/api/personal", methods=["GET"])
@require_auth("secretaria", "director")
def get_personal(current_user):
    """
    Lista todo el personal con enriquecimiento de subtipos.
    Respuesta item:
      { id, nombre, apellidoPaterno, apellidoMaterno, username,
        rol, telefono?, empresa?, constructoraId?, constructoraNombre? }
    """
    try:
        rows = Personal.query.order_by(Personal.rol, Personal.nombre).all()
        data = []
        for p in rows:
            item = {
                "id": (p.codigo_personal or "").strip(),
                "nombre": (p.nombre or "").strip(),
                "apellidoPaterno": (p.apellido_paterno or "").strip(),
                "apellidoMaterno": (p.apellido_materno or "").strip()
                if p.apellido_materno
                else "",
                "username": (p.username or "").strip(),
                "rol": (p.rol or "").strip(),
            }
            if p.rol == "Supervisor":
                sup = Supervisor.query.get(p.codigo_personal)
                if sup:
                    item["telefono"] = (sup.telefono or "").strip()
            elif p.rol == "Proyectista":
                proy = Proyectista.query.get(p.codigo_personal)
                if proy:
                    item["empresa"] = (proy.empresa or "").strip()
                    item["constructoraId"] = (proy.id_constructora or "").strip()
                    c = Constructora.query.get(proy.id_constructora)
                    item["constructoraNombre"] = (
                        (c.nombre_const or "").strip() if c else ""
                    )
            data.append(item)
        return ok(data)
    except Exception as exc:
        return db_error_response(exc)


@secretaria_bp.route("/api/personal", methods=["POST"])
@require_auth("secretaria")
def create_personal(current_user):
    """
    Body:
    {
      "nombre": "Héctor",
      "apellidoPaterno": "Villagrán",
      "apellidoMaterno": "Luna",
      "username": "sup003",
      "password": "12345",
      "rol": "Supervisor",
      "telefono": "5512345678"           ← obligatorio si rol = Supervisor
      "constructoraId": "CONS000001"    ← obligatorio si rol = Proyectista
    }

    Reglas:
      • username único.
      • código personal auto-generado por rol (SUP-NNN, PROY-NNN, DIR-NNN, SEC-NNN).
      • Proyectista: se requiere constructoraId; empresa se extrae
        automáticamente del nombre de la constructora seleccionada.
      • Supervisor: se requiere teléfono.
      • Director / Secretario: solo datos de personal.
    """
    body = request.get_json(silent=True) or {}
    valid, err = require_fields(
        body, "nombre", "apellidoPaterno", "username", "password", "rol"
    )
    if not valid:
        return err

    nombre = body["nombre"].strip()
    apellido_p = body["apellidoPaterno"].strip()
    apellido_m = (body.get("apellidoMaterno") or "").strip() or None
    username = body["username"].strip()
    password = body["password"].strip()
    rol = body["rol"].strip()

    ROLES_VALIDOS = {"Supervisor", "Director", "Secretario", "Proyectista"}
    if rol not in ROLES_VALIDOS:
        return bad_request(
            f"Rol inválido: '{rol}'. "
            f"Valores permitidos: {', '.join(sorted(ROLES_VALIDOS))}"
        )

    constructora_id = (body.get("constructoraId") or "").strip()
    telefono = (body.get("telefono") or "").strip()

    if rol == "Proyectista" and not constructora_id:
        return bad_request(
            "El campo 'constructora' es obligatorio para el rol Proyectista."
        )
    if rol == "Supervisor" and not telefono:
        return bad_request(
            "El campo 'teléfono' es obligatorio para el rol Supervisor."
        )

    try:
        # ── Validar duplicados ───────────────────────────────
        existing_user = Personal.query.filter(
            db.func.trim(Personal.username) == username
        ).first()
        if existing_user:
            return bad_request(
                f"El nombre de usuario '{username}' ya está registrado."
            )

        # ── Generar ID ───────────────────────────────────────
        new_id = _gen_personal_id(rol)

        # ── INSERT personal ──────────────────────────────────
        nuevo = Personal(
            codigo_personal=new_id,
            nombre=nombre[:100],
            apellido_paterno=apellido_p[:200],
            apellido_materno=apellido_m[:200] if apellido_m else None,
            username=username,
            password_hash=password,
            rol=rol,
        )
        db.session.add(nuevo)

        # ── INSERT subtipo ─────────────────────────────────
        if rol == "Proyectista":
            constructora = Constructora.query.get(constructora_id)
            if not constructora:
                return bad_request(
                    f"La constructora '{constructora_id}' no existe."
                )
            empresa = (constructora.nombre_const or "").strip()
            proy = Proyectista(
                codigo_personal=new_id,
                empresa=empresa[:200],
                id_constructora=constructora_id,
            )
            db.session.add(proy)
        elif rol == "Supervisor":
            sup = Supervisor(codigo_personal=new_id, telefono=telefono)
            db.session.add(sup)

        db.session.commit()
        return created(
            {"id": new_id, "nombre": nombre, "rol": rol},
            f"Personal registrado: {new_id} ({rol}).",
        )
    except Exception as exc:
        db.session.rollback()
        return db_error_response(exc)


@secretaria_bp.route("/api/personal/<personal_id>", methods=["DELETE"])
@require_auth("secretaria")
def delete_personal(personal_id, current_user):
    try:
        p = Personal.query.get(personal_id.strip())
        if not p:
            return not_found("Personal no encontrado.")

        # Eliminar subtipo primero (FK sin CASCADE en schema original)
        if p.rol == "Proyectista":
            Proyectista.query.filter_by(codigo_personal=p.codigo_personal).delete()
        elif p.rol == "Supervisor":
            Supervisor.query.filter_by(codigo_personal=p.codigo_personal).delete()

        db.session.delete(p)
        db.session.commit()
        return ok(message=f"Personal {personal_id} eliminado correctamente.")
    except Exception as exc:
        db.session.rollback()
        return db_error_response(exc)
