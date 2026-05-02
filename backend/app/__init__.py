import os
from flask import Flask, jsonify, request
from flask_cors import CORS
import sys
from dotenv import load_dotenv
from .database import init_db, db
load_dotenv()

def create_app() -> Flask:
    
    app = Flask(__name__)
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-secret-key")
    CORS(app, origins="*", methods=["GET","POST","PUT","DELETE","OPTIONS"], allow_headers="*")

    init_db(app)
    
    with app.app_context():
        from .models import Personal
    
    from routes.auth        import auth_bp
    from routes.director    import director_bp
    from routes.supervisor  import supervisor_bp
    from routes.secretaria  import secretaria_bp

    # Registro de Blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(director_bp)
    app.register_blueprint(supervisor_bp)
    app.register_blueprint(secretaria_bp)

    

@app.route("/auth/login", methods=["POST"])
def login():
    try:
        data = request.get_json()
        username = data.get("username")
        password = data.get("password")
        role = data.get("role")

        user = Personal.query.filter_by(usuario=username, rol=role).first()

        if user and user.contrasena == password: 
            return jsonify({
                "success": True,
                "message": f"Bienvenido al sistema, {user.nombre}",
                "data": {
                    "id_personal": user.id_personal,
                    "nombre": user.nombre,
                    "rol": user.rol
                }
            }), 200
        
        return jsonify({
            "success": False, 
            "message": "Usuario, contraseña o rol incorrectos"
        }), 401

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

    @app.route("/api/health")
    def health():
        return jsonify({"status": "ok", "service": "Obras Públicas — API v2.0"}), 200

    @app.errorhandler(404)
    def h404(e): return jsonify({"success":False,"message":"Ruta no encontrada."}), 404
    
    @app.errorhandler(405)
    def h405(e): return jsonify({"success":False,"message":"Método HTTP no permitido."}), 405
    
    @app.errorhandler(500)
    def h500(e): return jsonify({"success":False,"message":"Error interno del servidor."}), 500

    return app 
