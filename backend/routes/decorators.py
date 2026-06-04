from functools import wraps
from flask import request, jsonify

# Prefijo que identifica cuentas demo en codigo_personal
_DEMO_PREFIX = "DEMO-"

# Métodos HTTP que implican mutación de datos
_MUTATION_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def require_auth(*allowed_roles):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            role    = request.headers.get("X-User-Role", "").lower().strip()
            user_id = request.headers.get("X-User-Id",   "").strip()

            if not role or not user_id:
                return jsonify({"success": False, "message": "No autenticado."}), 401

            if allowed_roles and role not in allowed_roles:
                return jsonify({"success": False, "message": "Acceso denegado."}), 403

            is_demo = user_id.upper().startswith(_DEMO_PREFIX)

            # Bloquear mutaciones para usuarios demo antes de llegar al handler
            if is_demo and request.method in _MUTATION_METHODS:
                return jsonify({
                    "success": False,
                    "message": "Cuenta de demostración: solo lectura. "
                               "Esta acción no está permitida en el modo demo.",
                    "demo": True,
                }), 403

            current_user = {"id": user_id, "role": role, "is_demo": is_demo}
            return fn(*args, current_user=current_user, **kwargs)

        return wrapper
    return decorator
