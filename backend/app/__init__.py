# Back/app/__init__.py
import os
from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
load_dotenv()

def create_app() -> Flask:
    app = Flask(__name__)
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-secret-key")
    CORS(app, origins="*",
         allow_headers=["Content-Type","X-User-Role","X-User-Id","X-User-Nombre","X-User-Username"],
         methods=["GET","POST","PUT","DELETE","OPTIONS"])

    from app.middleware.auth import auth_bp
    from app.routes.director    import director_bp
    from app.routes.supervisor  import supervisor_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(director_bp)
    app.register_blueprint(supervisor_bp)


    @app.route("/api/health")
    def health():
        from app.database import test_connection
        db_ok = test_connection()
        return jsonify({"status":"ok" if db_ok else "degraded",
                        "database":"connected" if db_ok else "unreachable",
                        "service":"Obras Públicas — API v2.0"}), 200 if db_ok else 503

    @app.errorhandler(404)
    def h404(e): return jsonify({"success":False,"message":"Ruta no encontrada."}), 404
    @app.errorhandler(405)
    def h405(e): return jsonify({"success":False,"message":"Método HTTP no permitido."}), 405
    @app.errorhandler(500)
    def h500(e): return jsonify({"success":False,"message":"Error interno del servidor."}), 500

    return app
