"""
backend/routes/propuestas.py
========================================================================
"""

import re
from datetime import date
from functools import wraps

from flask import Blueprint, jsonify, make_response, request
from sqlalchemy import func

from app.database import db
from app.helpers import bad_request, created, db_error_response, ok, require_fields
from app.models import Poblador, PropuestaObra, VotoPropuesta
from app.password_security import hash_password, verify_password
from app.quadrimestre import CREDITOS_POR_PERIODO, periodo_actual
from app.temascaltepec_regions import rank_propuestas_por_proximidad
from app.token_security import issue_poblador_token, read_poblador_token

propuestas_bp = Blueprint("propuestas", __name__)

# =====================================================================
#  VALIDACIÓN DE CURP — Estado de México
# =====================================================================

# Formato oficial CURP: 18 caracteres alfanuméricos, sin Ñ en pos 11-12
_CURP_REGEX = re.compile(
    r'^[A-Z]{4}\d{6}[HM][A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[A-Z0-9]\d$',
    re.IGNORECASE
)

# Claves de entidad federativa del Estado de México en la CURP
# Fuente: RENAPO — catálogo oficial de claves de estados
_EDOMEX_CLAVES = {"MC", "ME"}   # "MC" histórico, "ME" actual


def _validar_curp(curp: str) -> tuple[bool, str]:
    """
    Valida formato y origen estatal de una CURP.
    Retorna (es_valida, mensaje_error).
    Si es_valida=True, el mensaje está vacío.
    """
    curp = curp.strip().upper()

    if len(curp) != 18:
        return False, "La CURP debe tener exactamente 18 caracteres."

    if not _CURP_REGEX.match(curp):
        return False, "El formato de la CURP no es válido."

    # Posiciones 11-12: clave de entidad federativa
    clave_estado = curp[11:13]
    if clave_estado not in _EDOMEX_CLAVES:
        return False, (
            f"La CURP no corresponde al Estado de México "
            f"(clave de estado detectada: '{clave_estado}'). "
            "Solo pueden registrarse residentes del Estado de México."
        )

    return True, ""


# =====================================================================
#  CORS helpers
# =====================================================================

def _add_cors_headers(response):
    if isinstance(response, tuple):
        body, status = response[0], response[1] if len(response) > 1 else 200
        response = make_response(body, status)
    elif not hasattr(response, "headers"):
        response = make_response(response)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Poblador-Token"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response


def _cors_preflight():
    return _add_cors_headers(make_response())


# =====================================================================
#  AUTH: token de poblador
# =====================================================================

def _extract_token() -> str | None:
    auth = request.headers.get("Authorization", "")
    if auth.lower().startswith("bearer "):
        return auth.split(" ", 1)[1].strip() or None
    direct = request.headers.get("X-Poblador-Token", "").strip()
    return direct or None


def require_poblador(fn):
    """Decorador que exige token válido de poblador."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        token = _extract_token()
        pid = read_poblador_token(token) if token else None
        if not pid:
            return _add_cors_headers((jsonify({
                "success": False,
                "message": "Sesión no válida. Inicia sesión como poblador.",
            }), 401))
        poblador = Poblador.query.get(pid)
        if not poblador:
            return _add_cors_headers((jsonify({
                "success": False,
                "message": "Sesión expirada. Vuelve a iniciar sesión.",
            }), 401))
        return fn(*args, poblador=poblador, **kwargs)
    return wrapper


# =====================================================================
#  HELPERS DE SERIALIZACIÓN
# =====================================================================

def _votos_actuales_map(periodo: str) -> dict[int, int]:
    rows = (
        db.session.query(VotoPropuesta.propuesta_id, func.count(VotoPropuesta.id))
        .filter(VotoPropuesta.periodo_voto == periodo)
        .group_by(VotoPropuesta.propuesta_id)
        .all()
    )
    return {pid: int(c) for pid, c in rows}


# =====================================================================
#  VALIDACIÓN DE CURP (endpoint público)
# =====================================================================

@propuestas_bp.route("/api/propuestas/curp/verify", methods=["POST", "OPTIONS"])
def verify_curp():
    """
    Valida que una CURP tenga formato correcto y sea del Estado de México.
    No guarda nada — es una verificación efímera antes del registro.
    """
    if request.method == "OPTIONS":
        return _cors_preflight()

    body = request.get_json(silent=True) or {}
    curp = (body.get("curp") or "").strip().upper()

    if not curp:
        return _add_cors_headers(bad_request("El campo 'curp' es requerido."))

    valida, mensaje = _validar_curp(curp)

    if not valida:
        return _add_cors_headers(ok({
            "valida": False,
            "motivo": mensaje,
        }, message="CURP no válida."))

    # Verificar si ya está registrada
    ya_registrada = bool(Poblador.query.filter_by(curp=curp).first())

    return _add_cors_headers(ok({
        "valida": True,
        "curp": curp,
        "estado": "Estado de México",
        "ya_registrada": ya_registrada,
    }, message="CURP verificada correctamente."))


# =====================================================================
#  REGISTRO Y LOGIN DE POBLADORES
# =====================================================================

@propuestas_bp.route("/api/propuestas/auth/register", methods=["POST", "OPTIONS"])
def register_poblador():
    if request.method == "OPTIONS":
        return _cors_preflight()

    body = request.get_json(silent=True) or {}
    valid, err = require_fields(
        body, "nombre", "apellidos", "comunidad", "username", "password", "curp"
    )
    if not valid:
        return _add_cors_headers(err)

    username = body["username"].strip().lower()
    curp     = body["curp"].strip().upper()
    password = body["password"]

    if len(username) < 4 or len(username) > 50:
        return _add_cors_headers(bad_request("El nombre de usuario debe tener entre 4 y 50 caracteres."))
    if len(password) < 6:
        return _add_cors_headers(bad_request("La contraseña debe tener al menos 6 caracteres."))

    # Validar CURP antes de tocar la BD
    curp_valida, curp_msg = _validar_curp(curp)
    if not curp_valida:
        return _add_cors_headers(bad_request(curp_msg))

    if Poblador.query.filter_by(username=username).first():
        return _add_cors_headers(bad_request("Ese nombre de usuario ya está registrado."))
    if Poblador.query.filter_by(curp=curp).first():
        return _add_cors_headers(bad_request("Esa CURP ya está registrada."))

    try:
        poblador = Poblador(
            nombre=body["nombre"].strip(),
            apellidos=body["apellidos"].strip(),
            comunidad=body["comunidad"].strip(),
            username=username,
            password_hash=hash_password(password),
            curp=curp,
        )
        db.session.add(poblador)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return _add_cors_headers(db_error_response(exc))

    token = issue_poblador_token(poblador.id)
    return _add_cors_headers(created({
        "token": token,
        "poblador": poblador.to_public_dict(),
    }, message="Cuenta creada exitosamente. ¡Bienvenido!"))


@propuestas_bp.route("/api/propuestas/auth/login", methods=["POST", "OPTIONS"])
def login_poblador():
    if request.method == "OPTIONS":
        return _cors_preflight()

    body = request.get_json(silent=True) or {}
    valid, err = require_fields(body, "username", "password")
    if not valid:
        return _add_cors_headers(err)

    username = body["username"].strip().lower()
    password = body["password"]

    poblador = Poblador.query.filter_by(username=username).first()
    if not poblador or not verify_password(password, poblador.password_hash):
        return _add_cors_headers((jsonify({
            "success": False,
            "message": "Usuario o contraseña incorrectos.",
        }), 401))

    token = issue_poblador_token(poblador.id)
    return _add_cors_headers(ok({
        "token": token,
        "poblador": poblador.to_public_dict(),
    }, message="Sesión iniciada."))


@propuestas_bp.route("/api/propuestas/auth/me", methods=["GET", "OPTIONS"])
@require_poblador
def me_poblador(poblador: Poblador):
    if request.method == "OPTIONS":
        return _cors_preflight()
    return _add_cors_headers(ok(poblador.to_public_dict()))


# =====================================================================
#  PROPUESTAS — listado, detalle, cercanas
# =====================================================================

@propuestas_bp.route("/api/propuestas/cercanas", methods=["POST", "OPTIONS"])
def propuestas_cercanas():
    """
    Hasta 5 propuestas más cercanas al usuario, SOLO si está dentro
    del radio del municipio de Temascaltepec (35km desde el centro).
    """
    if request.method == "OPTIONS":
        return _cors_preflight()

    body = request.get_json(silent=True) or {}
    try:
        lat = float(body.get("lat"))
        lng = float(body.get("lng"))
    except (TypeError, ValueError):
        return _add_cors_headers(bad_request("Coordenadas 'lat' y 'lng' inválidas."))

    try:
        todas = PropuestaObra.query.all()
        ranked, usuario_en_area = rank_propuestas_por_proximidad(
            lat, lng, todas, max_results=5
        )

        if not usuario_en_area:
            return _add_cors_headers(ok({
                "propuestas": [],
                "usuario_en_area": False,
                "mensaje": (
                    "Tu ubicación no corresponde al municipio de Temascaltepec. "
                    "Esta sección muestra propuestas únicamente para residentes del municipio."
                ),
            }))

        if not ranked:
            return _add_cors_headers(ok({
                "propuestas": [],
                "usuario_en_area": True,
                "mensaje": (
                    "No hay propuestas registradas cerca de tu comunidad para este "
                    "periodo. ¡Sé el primero en proponer una obra para tu región!"
                ),
            }))

        votos = _votos_actuales_map(periodo_actual())
        data = [p.to_public_dict(votos=votos.get(p.id, 0)) for p in ranked]
        return _add_cors_headers(ok({
            "propuestas": data,
            "usuario_en_area": True,
        }))

    except Exception as exc:
        return _add_cors_headers(db_error_response(exc))


@propuestas_bp.route("/api/propuestas", methods=["GET", "OPTIONS"])
def listar_propuestas():
    if request.method == "OPTIONS":
        return _cors_preflight()
    try:
        propuestas = PropuestaObra.query.order_by(PropuestaObra.creado_en.desc()).all()
        votos = _votos_actuales_map(periodo_actual())
        return _add_cors_headers(ok({
            "propuestas": [p.to_public_dict(votos=votos.get(p.id, 0)) for p in propuestas],
            "periodo": periodo_actual(),
        }))
    except Exception as exc:
        return _add_cors_headers(db_error_response(exc))


@propuestas_bp.route("/api/propuestas/<int:propuesta_id>", methods=["GET", "OPTIONS"])
def detalle_propuesta(propuesta_id: int):
    if request.method == "OPTIONS":
        return _cors_preflight()
    propuesta = PropuestaObra.query.get(propuesta_id)
    if not propuesta:
        return _add_cors_headers((jsonify({"success": False, "message": "Propuesta no encontrada."}), 404))
    votos = _votos_actuales_map(periodo_actual()).get(propuesta.id, 0)
    return _add_cors_headers(ok(propuesta.to_public_dict(votos=votos)))


# =====================================================================
#  REGISTRO DE PROPUESTA (autenticado)
# =====================================================================

@propuestas_bp.route("/api/propuestas", methods=["POST"])
@require_poblador
def crear_propuesta(poblador: Poblador):
    body = request.get_json(silent=True) or {}
    valid, err = require_fields(
        body, "titulo", "region", "descripcion_obra",
        "descripcion_beneficiados", "pros_comunidad"
    )
    if not valid:
        return _add_cors_headers(err)

    titulo = body["titulo"].strip()
    region = body["region"].strip()
    if len(titulo) > 150:
        return _add_cors_headers(bad_request("El título no puede exceder 150 caracteres."))
    if len(region) > 100:
        return _add_cors_headers(bad_request("El nombre de región no puede exceder 100 caracteres."))

    try:
        propuesta = PropuestaObra(
            poblador_id=poblador.id,
            titulo=titulo,
            region=region,
            descripcion_obra=body["descripcion_obra"].strip(),
            descripcion_beneficiados=body["descripcion_beneficiados"].strip(),
            pros_comunidad=body["pros_comunidad"].strip(),
            anio_convocatoria=date.today().year,
        )
        db.session.add(propuesta)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return _add_cors_headers(db_error_response(exc))

    return _add_cors_headers(created(
        propuesta.to_public_dict(votos=0),
        message="Propuesta registrada con éxito.",
    ))


# =====================================================================
#  VOTAR (autenticado, max 3 por cuatrimestre)
# =====================================================================

@propuestas_bp.route("/api/propuestas/<int:propuesta_id>/votar", methods=["POST", "OPTIONS"])
def votar_propuesta(propuesta_id: int):
    if request.method == "OPTIONS":
        return _cors_preflight()

    token = _extract_token()
    pid = read_poblador_token(token) if token else None
    if not pid:
        return _add_cors_headers((jsonify({"success": False, "message": "Inicia sesión para poder votar."}), 401))
    poblador = Poblador.query.get(pid)
    if not poblador:
        return _add_cors_headers((jsonify({"success": False, "message": "Sesión expirada."}), 401))

    propuesta = PropuestaObra.query.get(propuesta_id)
    if not propuesta:
        return _add_cors_headers((jsonify({"success": False, "message": "Propuesta no encontrada."}), 404))

    periodo = periodo_actual()
    consumidos = (
        VotoPropuesta.query
        .filter_by(poblador_id=poblador.id, periodo_voto=periodo)
        .count()
    )
    if consumidos >= CREDITOS_POR_PERIODO:
        return _add_cors_headers(bad_request(
            f"Has agotado tus {CREDITOS_POR_PERIODO} créditos del periodo {periodo}. "
            "Se regenerarán el próximo cuatrimestre."
        ))

    repetido = VotoPropuesta.query.filter_by(
        poblador_id=poblador.id, propuesta_id=propuesta.id, periodo_voto=periodo
    ).first()
    if repetido:
        return _add_cors_headers(bad_request("Ya votaste por esta propuesta en el periodo actual."))

    try:
        voto = VotoPropuesta(
            poblador_id=poblador.id,
            propuesta_id=propuesta.id,
            periodo_voto=periodo,
        )
        db.session.add(voto)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return _add_cors_headers(db_error_response(exc))

    nuevos_usados = consumidos + 1
    votos_propuesta = VotoPropuesta.query.filter_by(
        propuesta_id=propuesta.id, periodo_voto=periodo
    ).count()

    return _add_cors_headers(created({
        "propuesta_id": propuesta.id,
        "periodo": periodo,
        "votos_propuesta": int(votos_propuesta),
        "creditos_totales": CREDITOS_POR_PERIODO,
        "creditos_usados": int(nuevos_usados),
        "creditos_restantes": max(0, CREDITOS_POR_PERIODO - int(nuevos_usados)),
    }, message="Voto registrado."))
