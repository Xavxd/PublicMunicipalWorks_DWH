# routes/auth.py
from flask import Blueprint, request, jsonify
from app.models import Personal  # Importamos el modelo que reside en app/

auth_bp = Blueprint('auth', __name__)

@auth_bp.route("/api/auth/login", methods=["POST"])
def login():
    try:
        data = request.get_json()
        user_input = data.get("username")
        pass_input = data.get("password")
        role_portal = data.get("role")  # El rol del portal desde el que intenta entrar

        if not all([user_input, pass_input, role_portal]):
            return jsonify({"success": False, "message": "Datos incompletos."}), 400

        # --- VALIDACIÓN CRÍTICA CON ORM ---
        # Buscamos al usuario que coincida con el username Y con el rol del portal.
        # Esto previene SQL Injection y valida el permiso de acceso simultáneamente.
        usuario = Personal.query.filter_by(
            username=user_input, 
            rol=role_portal
        ).first()

        # 1. Si no existe la combinación Usuario + Rol
        if not usuario:
            return jsonify({
                "success": False, 
                "message": f"Acceso denegado: El usuario no tiene perfil de {role_portal}."
            }), 403

        # 2. Si existe el usuario en ese rol, validamos la contraseña (texto plano por ahora)
        if usuario.password_hash != pass_input:
            return jsonify({
                "success": False, 
                "message": "Contraseña incorrecta."
            }), 401

        # 3. Éxito: Retornamos los datos para el sessionStorage del frontend
        return jsonify({
            "success": True,
            "message": f"Bienvenido/a, {usuario.nombre}",
            "data": usuario.to_dict()
        }), 200

    except Exception as e:
        return jsonify({"success": False, "message": f"Error interno: {str(e)}"}), 500
