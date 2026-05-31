"""
backend/routes/propuestas.py
========================================================================
SISTEMA DE PRESUPUESTO PARTICIPATIVO - Temascaltepec

CAMBIOS v2:
- propuestas_cercanas(): usa nueva firma de rank_propuestas_por_proximidad
  que retorna (lista, usuario_en_area). Si el usuario está fuera del
  municipio (ej. CDMX), retorna lista vacía con mensaje explicativo
  en lugar de propuestas irrelevantes.
========================================================================
"""

from datetime import date
from functools import wraps

from flask import Blueprint, jsonify, make_response, request
from sqlalchemy import func

from app.database import db
from app.gemini_ine import GeminiConfigError, verify_ine_image
from app.helpers import bad_request, created, db_error_response, ok, require_fields
from app.models import Poblador, PropuestaObra, VotoPropuesta
from app.password_security import hash_password, verify_password
from app.quadrimestre import CREDITOS_POR_PERIODO, periodo_actual
from app.temascaltepec_regions import rank_propuestas_por_proximidad
from app.token_security import issue_poblador_token, read_poblador_token

propuestas_bp = Blueprint("propuestas", __name__)

ALLOWED_INE_MIME = {"image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic"}
MAX_INE_BYTES = 10 * 1024 * 1024  # 10 MB


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
    """Conteo de votos por propuesta en el periodo dado."""
    rows = (
        db.session.query(VotoPropuesta.propuesta_id, func.count(VotoPropuesta.id))
        .filter(VotoPropuesta.periodo_voto == periodo)
        .group_by(VotoPropuesta.propuesta_id)
        .all()
    )
    return {pid: int(c) for pid, c in rows}


# =====================================================================
#  VALIDACIÓN EFÍMERA DE INE
# =====================================================================

@propuestas_bp.route("/api/propuestas/ine/verify", methods=["POST", "OPTIONS"])
def verify_ine():
    """
    Procesa una foto del reverso de la INE en RAM y la valida con Gemini.
    La imagen JAMÁS toca el disco.
    """
    if request.method == "OPTIONS":
        return _cors_preflight()

    upload = request.files.get("file") or request.files.get("ine")
    if not upload:
        return _add_cors_headers(bad_request(
            "Adjunta la imagen del reverso de tu INE en el campo 'file'."
        ))

    mime = (upload.mimetype or "").lower().strip()
    if mime and mime not in ALLOWED_INE_MIME:
        return _add_cors_headers(bad_request(
            "Formato no soportado. Sube una foto JPG, PNG o WEBP."
        ))

    image_bytes = upload.read()
    if not image_bytes:
        return _add_cors_headers(bad_request("La imagen llegó vacía, intenta de nuevo."))
    if len(image_bytes) > MAX_INE_BYTES:
        return _add_cors_headers(bad_request(
            "La imagen excede 10 MB. Comprímela e intenta otra vez."
        ))

    try:
        result = verify_ine_image(image_bytes, mime_type=mime or "image/jpeg")
    except GeminiConfigError as exc:
        return _add_cors_headers((jsonify({
            "success": False,
            "message": f"Servicio de verificación no disponible: {exc}",
        }), 503))
    except Exception as exc:
        return _add_cors_headers(db_error_response(exc))
    finally:
        image_bytes = None  # Liberar referencia explícitamente

    pertenece = bool(result.get("pertenece_a_temascaltepec"))
    es_ine = bool(result.get("es_ine"))

    if not es_ine:
        return _add_cors_headers(ok({
            "valida": False,
            "motivo": "La imagen no corresponde al reverso de una INE.",
            "es_ine": False,
            "pertenece_a_temascaltepec": False,
        }, message="INE no reconocida."))

    if not pertenece:
        return _add_cors_headers(ok({
            "valida": False,
            "motivo": "La INE no pertenece al municipio de Temascaltepec.",
            "es_ine": True,
            "pertenece_a_temascaltepec": False,
            "estado": result.get("estado"),
            "municipio": result.get("municipio"),
        }, message="Región no válida para el registro."))

    clave = (result.get("clave_elector") or "").strip().upper()
    # Solo consultar BD si tenemos una clave válida de 18 chars
    existe = (
        Poblador.query.filter_by(clave_elector_ine=clave).first()
        if clave and len(clave) == 18
        else None
    )
    return _add_cors_headers(ok({
        "valida": True,
        "es_ine": True,
        "pertenece_a_temascaltepec": True,
        "estado": result.get("estado"),
        "municipio": result.get("municipio"),
        "clave_elector": clave,
        "ya_registrada": bool(existe),
    }, message="Identificación verificada."))


# =====================================================================
#  REGISTRO Y LOGIN DE POBLADORES
# =====================================================================

@propuestas_bp.route("/api/propuestas/auth/register", methods=["POST", "OPTIONS"])
def register_poblador():
    if request.method == "OPTIONS":
        return _cors_preflight()

    body = request.get_json(silent=True) or {}
    valid, err = require_fields(
        body, "nombre", "apellidos", "comunidad", "username", "password", "clave_elector_ine"
    )
    if not valid:
        return _add_cors_headers(err)

    username = body["username"].strip().lower()
    clave = body["clave_elector_ine"].strip().upper()
    password = body["password"]

    if len(username) < 4 or len(username) > 50:
        return _add_cors_headers(bad_request("El nombre de usuario debe tener entre 4 y 50 caracteres."))
    if len(password) < 6:
        return _add_cors_headers(bad_request("La contraseña debe tener al menos 6 caracteres."))
    if len(clave) != 18:
        return _add_cors_headers(bad_request("La clave de elector debe tener 18 caracteres."))

    if Poblador.query.filter_by(username=username).first():
        return _add_cors_headers(bad_request("Ese nombre de usuario ya está registrado."))
    if Poblador.query.filter_by(clave_elector_ine=clave).first():
        return _add_cors_headers(bad_request("Esa clave de elector ya está registrada."))

    try:
        poblador = Poblador(
            nombre=body["nombre"].strip(),
            apellidos=body["apellidos"].strip(),
            comunidad=body["comunidad"].strip(),
            username=username,
            password_hash=hash_password(password),
            clave_elector_ine=clave,
        )
        db.session.add(poblador)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return _add_cors_headers(db_error_response(exc))

    token = issue_poblador_token(poblador.id)
    return _add_cors_headers(created({
        "poblador": poblador.to_public_dict(),
        "token": token,
    }, message="Cuenta creada con éxito."))


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
        "poblador": poblador.to_public_dict(),
        "token": token,
    }, message="Sesión iniciada."))


@propuestas_bp.route("/api/propuestas/auth/me", methods=["GET", "OPTIONS"])
def me_poblador():
    if request.method == "OPTIONS":
        return _cors_preflight()

    token = _extract_token()
    pid = read_poblador_token(token) if token else None
    if not pid:
        return _add_cors_headers((jsonify({
            "success": False,
            "message": "Sin sesión activa.",
        }), 401))
    poblador = Poblador.query.get(pid)
    if not poblador:
        return _add_cors_headers((jsonify({
            "success": False,
            "message": "Sesión expirada.",
        }), 401))

    periodo = periodo_actual()
    consumidos = (
        VotoPropuesta.query
        .filter_by(poblador_id=poblador.id, periodo_voto=periodo)
        .count()
    )
    return _add_cors_headers(ok({
        "poblador": poblador.to_public_dict(),
        "periodo": periodo,
        "creditos_totales": CREDITOS_POR_PERIODO,
        "creditos_usados": int(consumidos),
        "creditos_restantes": max(0, CREDITOS_POR_PERIODO - int(consumidos)),
    }))


# =====================================================================
#  LISTADOS DE PROPUESTAS
# =====================================================================

@propuestas_bp.route("/api/propuestas/trending", methods=["GET", "OPTIONS"])
def trending_propuestas():
    """Top 5 más votadas en el periodo cuatrimestral actual."""
    if request.method == "OPTIONS":
        return _cors_preflight()

    try:
        periodo = periodo_actual()
        top = (
            db.session.query(VotoPropuesta.propuesta_id, func.count(VotoPropuesta.id).label("votos"))
            .filter(VotoPropuesta.periodo_voto == periodo)
            .group_by(VotoPropuesta.propuesta_id)
            .order_by(func.count(VotoPropuesta.id).desc())
            .limit(5)
            .all()
        )

        propuestas_ordenadas: list = []
        votos_por_id: dict[int, int] = {}
        for pid, vcount in top:
            votos_por_id[int(pid)] = int(vcount)

        if votos_por_id:
            rows = PropuestaObra.query.filter(PropuestaObra.id.in_(votos_por_id.keys())).all()
            rows.sort(key=lambda p: votos_por_id.get(p.id, 0), reverse=True)
            propuestas_ordenadas = rows

        # Si aún no hay votos: devolver las 5 más recientes
        if not propuestas_ordenadas:
            propuestas_ordenadas = (
                PropuestaObra.query
                .order_by(PropuestaObra.creado_en.desc())
                .limit(5)
                .all()
            )

        data = [
            p.to_public_dict(votos=votos_por_id.get(p.id, 0))
            for p in propuestas_ordenadas
        ]
        return _add_cors_headers(ok({
            "periodo": periodo,
            "propuestas": data,
        }))
    except Exception as exc:
        return _add_cors_headers(db_error_response(exc))


@propuestas_bp.route("/api/propuestas/cercanas", methods=["POST", "OPTIONS"])
def propuestas_cercanas():
    """
    Hasta 5 propuestas más cercanas al usuario, SOLO si está dentro
    del radio del municipio de Temascaltepec (35km desde el centro).
    Usuarios en CDMX u otras ciudades recibirán lista vacía con mensaje.
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

        # Nueva firma: retorna (lista, usuario_en_area)
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
    """Listado público completo."""
    if request.method == "OPTIONS":
        return _cors_preflight()

    try:
        propuestas = (
            PropuestaObra.query
            .order_by(PropuestaObra.creado_en.desc())
            .all()
        )
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
        return _add_cors_headers((jsonify({
            "success": False,
            "message": "Propuesta no encontrada.",
        }), 404))
    votos = _votos_actuales_map(periodo_actual()).get(propuesta.id, 0)
    return _add_cors_headers(ok(propuesta.to_public_dict(votos=votos)))


# =====================================================================
#  REGISTRO DE NUEVA PROPUESTA (autenticado)
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
        return _add_cors_headers((jsonify({
            "success": False,
            "message": "Inicia sesión para poder votar.",
        }), 401))
    poblador = Poblador.query.get(pid)
    if not poblador:
        return _add_cors_headers((jsonify({
            "success": False,
            "message": "Sesión expirada.",
        }), 401))

    propuesta = PropuestaObra.query.get(propuesta_id)
    if not propuesta:
        return _add_cors_headers((jsonify({
            "success": False,
            "message": "Propuesta no encontrada.",
        }), 404))

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

    repetido = (
        VotoPropuesta.query
        .filter_by(poblador_id=poblador.id,
                   propuesta_id=propuesta.id,
                   periodo_voto=periodo)
        .first()
    )
    if repetido:
        return _add_cors_headers(bad_request(
            "Ya votaste por esta propuesta en el periodo actual."
        ))

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
    votos_propuesta = (
        VotoPropuesta.query
        .filter_by(propuesta_id=propuesta.id, periodo_voto=periodo)
        .count()
    )

    return _add_cors_headers(created({
        "propuesta_id": propuesta.id,
        "periodo": periodo,
        "votos_propuesta": int(votos_propuesta),
        "creditos_totales": CREDITOS_POR_PERIODO,
        "creditos_usados": int(nuevos_usados),
        "creditos_restantes": max(0, CREDITOS_POR_PERIODO - int(nuevos_usados)),
    }, message="Voto registrado."))
