"""
backend/app/middleware/auth.py
Decorador de autenticación basado en headers HTTP.
El frontend inyecta X-User-Role y X-User-Id en cada petición
desde sessionStorage (ver js/api_client.js → authHeaders()).
"""

from functools import wraps
from flask import request
from app.helpers import bad_request

VALID_ROLES = {"director", "supervisor", "proyectista", "secretaria"}


def get_current_user() -> dict:
    return {
        "role":     request.headers.get("X-User-Role", "").lower(),
        "id":       request.headers.get("X-User-Id", ""),
        "nombre":   request.headers.get("X-User-Nombre", ""),
        "username": request.headers.get("X-User-Username", ""),
    }


def require_auth(*allowed_roles):
    """
    Protege un endpoint verificando rol e identidad.
    Inyecta `current_user` como kwarg a la función decorada.

    Uso:
        @require_auth("director")
        @require_auth("director", "supervisor")
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            user = get_current_user()

            if not user["role"] or user["role"] not in VALID_ROLES:
                return bad_request(
                    "Autenticación requerida. "
                    "Headers X-User-Role / X-User-Id ausentes o inválidos."
                ), 401

            if allowed_roles and user["role"] not in allowed_roles:
                return bad_request(
                    f"Acceso denegado. El rol '{user['role']}' "
                    "no tiene permiso para esta operación."
                ), 403

            if not user["id"]:
                return bad_request("Header X-User-Id requerido."), 401

            return fn(*args, current_user=user, **kwargs)
        return wrapper
    return decorator
