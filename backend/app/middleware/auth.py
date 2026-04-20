# Back/app/middleware/auth.py
# ================================================================
#  MODO DESARROLLO / TESTING
#
#  El decorador @require_auth está desactivado para permitir
#  pruebas sin sistema de login implementado.
#
#  Cuando implementes auth real, reemplaza este archivo por
#  la versión que valide JWT/sesión. La firma de todas las
#  rutas (current_user) se mantiene igual — sólo cambia este
#  decorador, nada más.
# ================================================================

from functools import wraps
from flask import request

# Usuario ficticio que reciben todas las rutas como current_user
_DEV_USER = {
    "id":       "DEV_DIRECTOR",
    "role":     "director",
    "nombre":   "Director de Prueba",
    "username": "dev_director",
}


def require_auth(*allowed_roles):
    """
    Decorador de autenticación — MODO TESTING.
    Acepta cualquier petición y pasa _DEV_USER como current_user.
    Los roles permitidos se ignoran por ahora.

    Uso (no cambia):
        @require_auth("director")
        def mi_ruta(current_user):
            ...
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            return fn(*args, current_user=_DEV_USER, **kwargs)
        return wrapper
    return decorator
