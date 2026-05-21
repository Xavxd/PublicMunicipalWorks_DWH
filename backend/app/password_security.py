# app/password_security.py
# ===================================================================
#  CAPA DE SEGURIDAD DE CONTRASENAS — Obras Publicas
# -------------------------------------------------------------------
#  Utilidad para hashear y verificar contrasenas usando PBKDF2-SHA256
#  (via werkzeug.security). No requiere dependencias adicionales:
#  Werkzeug ya esta listado en requirements.txt.
#
#  Metodo: PBKDF2-HMAC-SHA256 con salt aleatorio de 16 bytes,
#          260000 iteraciones (configuracion segura por defecto).
# ===================================================================

from werkzeug.security import generate_password_hash, check_password_hash


def hash_password(plain_password: str) -> str:
    """
    Genera un hash seguro a partir de una contrasena en texto plano.

    Uso:
        hashed = hash_password("miContrasena123")
        # Guardar 'hashed' en la columna password_hash de la BD

    Retorna:
        str: Hash en formato "pbkdf2:sha256:salt$iterations$hash"
    """
    return generate_password_hash(plain_password, method="pbkdf2:sha256", salt_length=16)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifica si una contrasena en texto plano coincide con su hash.

    Uso:
        if verify_password(pass_input, usuario.password_hash):
            # Acceso permitido

    Retorna:
        bool: True si coinciden, False en caso contrario.
    """
    return check_password_hash(hashed_password, plain_password)
