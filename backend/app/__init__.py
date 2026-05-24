import os
from flask import Flask, jsonify, request
from flask_cors import CORS
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
    from routes.proyectista import proyectista_bp

    from routes.public import public_bp
    app.register_blueprint(public_bp)
    

    # Registro de Blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(director_bp)
    app.register_blueprint(supervisor_bp)
    app.register_blueprint(secretaria_bp)
    app.register_blueprint(proyectista_bp)


    @app.route("/api/health")
    def health():
        return jsonify({"status": "ok", "service": "API Obras Públicas"}), 200


    return app 
