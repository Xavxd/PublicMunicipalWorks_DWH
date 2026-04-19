"""
backend/app/__init__.py
Flask application factory.
- BD: Supabase (psycopg2, connection string en .env raíz del repo)
- Servidor: Waitress (Windows) / Gunicorn (Linux/Mac) — sin Render
- CORS abierto en desarrollo; restringir origins en producción
"""

import os
from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from pathlib import Path

# .env en la raíz del repo (un nivel arriba de /backend)
load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")


def create_app() -> Flask:
    app = Flask(__name__)
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-secret-obras-2026")

    # CORS: en dev permite cualquier origen; en prod ajusta origins=["https://tudominio.com"]
    CORS(
        app,
        origins=os.getenv("CORS_ORIGINS", "*").split(","),
        allow_headers=[
            "Content-Type",
            "X-User-Role",
            "X-User-Id",
            "X-User-Nombre",
            "X-User-Username",
            "X-API-KEY",
        ],
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    )

    # ── Blueprints ────────────────────────────────────────────────
    from app.routes.auth        import auth_bp
    from app.routes.director    import director_bp
    from app.routes.supervisor  import supervisor_bp
    from app.routes.proyectista import proyectista_bp
    from app.routes.secretaria  import secretaria_bp
    from app.routes.reportes    import reportes_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(director_bp)
    app.register_blueprint(supervisor_bp)
    app.register_blueprint(proyectista_bp)
    app.register_blueprint(secretaria_bp)
    app.register_blueprint(reportes_bp)

    # ── Health check ──────────────────────────────────────────────
    @app.route("/api/health")
    def health():
        from app.database import test_connection
        db_ok = test_connection()
        return jsonify({
            "status":   "ok" if db_ok else "degraded",
            "database": "supabase-connected" if db_ok else "unreachable",
            "service":  "Obras Públicas API",
            "version":  "2.0.0",
        }), 200 if db_ok else 503

    # ── Manejadores de error globales ─────────────────────────────
    @app.errorhandler(404)
    def handle_404(e):
        return jsonify({"success": False, "message": "Ruta no encontrada."}), 404

    @app.errorhandler(405)
    def handle_405(e):
        return jsonify({"success": False, "message": "Método HTTP no permitido."}), 405

    @app.errorhandler(500)
    def handle_500(e):
        return jsonify({"success": False, "message": "Error interno del servidor."}), 500

    return app
