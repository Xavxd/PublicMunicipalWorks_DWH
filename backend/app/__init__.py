import os
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
from .database import init_db, db
load_dotenv()

def create_app() -> Flask:

    app = Flask(__name__)
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-secret-key")
    CORS(app, resources={r"/*": {"origins": "*", "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"], "allow_headers": "*"}})

    init_db(app)

    with app.app_context():
        from .models import Personal

    from routes.auth        import auth_bp
    from routes.director    import director_bp
    from routes.supervisor  import supervisor_bp
    from routes.secretaria  import secretaria_bp
    from routes.proyectista import proyectista_bp
    from routes.public      import public_bp
    from routes.propuestas  import propuestas_bp
    from routes.imagenes    import imagenes_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(director_bp)
    app.register_blueprint(supervisor_bp)
    app.register_blueprint(secretaria_bp)
    app.register_blueprint(proyectista_bp)
    app.register_blueprint(public_bp)
    app.register_blueprint(propuestas_bp)
    app.register_blueprint(imagenes_bp)


    @app.route("/api/health")
    def health():
        return jsonify({"status": "ok", "service": "API Obras Públicas"}), 200

    @app.route("/api/debug/r2")
    def debug_r2():
        from app.r2_storage import R2_PUBLIC_URL, R2_BUCKET_NAME, R2_ENDPOINT_URL, build_object_key
        test_key = build_object_key("OBRA_TEST", 2026, 6, "test.jpg")
        return jsonify({
            "R2_PUBLIC_URL":   R2_PUBLIC_URL,
            "R2_BUCKET_NAME":  R2_BUCKET_NAME,
            "R2_ENDPOINT_URL": R2_ENDPOINT_URL,
            "test_object_key": test_key,
            "test_url_final":  f"{R2_PUBLIC_URL}/{test_key}",
        }), 200


    return app
