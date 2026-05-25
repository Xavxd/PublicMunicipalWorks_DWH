import os
from flask import Flask, jsonify
from flask_cors import CORS


def create_app(config_name=None):
    app = Flask(__name__)
    
    env_config = os.environ.get('FLASK_ENV', 'production')
    config_name = config_name or env_config

    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get(
        'DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/obras'
    )
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key')
    app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'jwt-dev-secret')
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = 86400  # 24 horas

   
    CORS(app, resources={
        r"/api/public/*": {
            "origins": "*",
            "methods": ["GET", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"]
        }
    })

  
    from app.extensions import db, jwt, bcrypt
    db.init_app(app)
    jwt.init_app(app)
    bcrypt.init_app(app)


    # Sistema de autenticacion y roles (existente, NO modificado)
    from app.routes.auth import auth_bp
    from app.routes.obras import obras_bp
    from app.routes.presupuestos import presupuestos_bp
    from app.routes.reportes import reportes_bp
    from app.routes.constructoras import constructoras_bp
    from app.routes.regiones import regiones_bp
    from app.routes.usuarios import usuarios_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(obras_bp, url_prefix='/api/obras')
    app.register_blueprint(presupuestos_bp, url_prefix='/api/presupuestos')
    app.register_blueprint(reportes_bp, url_prefix='/api/reportes')
    app.register_blueprint(constructoras_bp, url_prefix='/api/constructoras')
    app.register_blueprint(regiones_bp, url_prefix='/api/regiones')
    app.register_blueprint(usuarios_bp, url_prefix='/api/usuarios')

    # API publica para el mapa inteligente (nueva)
    from app.routes.public import public_bp
    app.register_blueprint(public_bp, url_prefix='/api/public')

    # =====================================================================
    # RUTA DE SALUD
    # =====================================================================
    @app.route('/health')
    def health_check():
        return jsonify({'status': 'ok', 'service': 'obras-publicas-api'})

    # =====================================================================
    # CREAR TABLAS (solo en desarrollo)
    # =====================================================================
    with app.app_context():
        try:
            from app.models import (
                Usuario, Obra, Presupuesto, Reporte,
                Constructora, Region, AsignacionPresupuesto
            )
            db.create_all()
        except Exception as e:
            app.logger.warning(f"No se pudieron crear tablas automaticamente: {e}")

    return app
