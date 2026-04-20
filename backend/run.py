"""
backend/run.py
Punto de entrada de la aplicación Flask.

Desarrollo local:
    cd backend
    python run.py

Producción (cualquier servidor Linux con Gunicorn):
    cd backend
    gunicorn run:app --workers 2 --bind 0.0.0.0:5000 --timeout 120

Alternativa Windows (Waitress):
    cd backend
    waitress-serve --host=0.0.0.0 --port=5000 run:app
"""

import sys
import os

# Asegura que Python encuentre el paquete `app` desde /backend/
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app

app = create_app()

if __name__ == "__main__":
    port  = int(os.getenv("PORT", 5000))
    debug = os.getenv("FLASK_ENV", "production") == "development"
    print(f"[obras-api] Iniciando en http://0.0.0.0:{port}  debug={debug}")
    app.run(host="0.0.0.0", port=port, debug=debug)
