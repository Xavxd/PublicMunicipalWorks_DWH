# Back/app/helpers.py
# ================================================================
#  Funciones de respuesta HTTP y validación reutilizadas
#  en todas las rutas del backend.
# ================================================================

from flask import jsonify


# ── Respuestas estándar ──────────────────────────────────────────

def ok(data=None, message="OK"):
    """200 — operación exitosa con datos."""
    payload = {"success": True, "message": message}
    if data is not None:
        payload["data"] = data
    return jsonify(payload), 200


def created(data=None, message="Recurso creado exitosamente."):
    """201 — recurso creado."""
    payload = {"success": True, "message": message}
    if data is not None:
        payload["data"] = data
    return jsonify(payload), 201


def bad_request(message="Solicitud inválida."):
    """400 — error de validación o datos incorrectos."""
    return jsonify({"success": False, "message": message}), 400


def not_found(message="Recurso no encontrado."):
    """404 — el recurso solicitado no existe."""
    return jsonify({"success": False, "message": message}), 404


def forbidden(message="Acceso denegado."):
    """403 — sin permiso."""
    return jsonify({"success": False, "message": message}), 403


def db_error_response(exc: Exception):
    """
    500 — error de base de datos.
    Imprime el detalle en consola pero NO lo expone al cliente.
    """
    import traceback
    traceback.print_exc()
    print(f"[DB ERROR] {type(exc).__name__}: {exc}")
    return jsonify({
        "success": False,
        "message": "Error interno del servidor. Revisa los logs del backend."
    }), 500


# ── Validación de campos ─────────────────────────────────────────

def require_fields(body: dict, *fields):
    """
    Verifica que todos los campos estén presentes y no vacíos en `body`.

    Uso:
        valid, err_response = require_fields(body, "nombre", "rfc", "tipo")
        if not valid:
            return err_response

    Retorna (True, None) si todo está bien,
    o (False, Response 400) si falta algún campo.
    """
    missing = [f for f in fields if not body.get(f)]
    if missing:
        return False, bad_request(
            f"Campos requeridos faltantes o vacíos: {', '.join(missing)}"
        )
    return True, None


def forbidden(message="Acceso denegado."):
    """Retorna una respuesta 403 Forbidden."""
    return jsonify({"success": False, "message": message}), 403
