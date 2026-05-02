from functools import wraps
from flask import request, jsonify

def require_auth(*allowed_roles):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            role = request.headers.get('X-User-Role', '')
            user_id = request.headers.get('X-User-Id', '')
            if not role or not user_id:
                return jsonify({"success": False, "message": "No autenticado."}), 401
            if allowed_roles and role not in allowed_roles:
                return jsonify({"success": False, "message": "Acceso denegado."}), 403
            current_user = {"id": user_id, "role": role}
            return fn(*args, current_user=current_user, **kwargs)
        return wrapper
    return decorator