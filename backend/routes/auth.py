# routes/auth.py
from flask import Blueprint, request, jsonify
from app.models import Personal
from app.password_security import verify_password

auth_bp = Blueprint('auth', __name__)

@auth_bp.route("/api/auth/login", methods=["POST"])
def login():
    try:
        data = request.get_json()
        user_input = data.get("username")
        pass_input = data.get("password") 
        role_portal = data.get("role")

        if not all([user_input, pass_input, role_portal]):
            return jsonify({"success": False, "message": "Datos incompletos."}), 400

        usuario = Personal.query.filter_by(
            username=user_input, 
            rol=role_portal
        ).first()

        # 1. Si no existe la combinacion Usuario + Rol
        #    o la contrasena no verifica contra el hash almacenado
        if not usuario or not verify_password(pass_input, usuario.password_hash):
            return jsonify({
                "success": False, 
                "message": "Credenciales o rol incorrectos."
            }), 401

        return jsonify({
            "success": True,
            "data": usuario.to_dict()
        }), 200

    except Exception as e:
        return jsonify({"success": False, "message": f"Error: {str(e)}"}), 500
