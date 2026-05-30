# app/token_security.py
# ===================================================================
#  TOKENS DE SESION PARA POBLADORES
# -------------------------------------------------------------------
#  Para el modulo de presupuesto participativo necesitamos un
#  mecanismo de autenticacion ligero independiente del flujo del
#  personal del Ayuntamiento.
#
#  Usamos itsdangerous (ya instalado como dependencia transitiva de
#  Flask) para firmar tokens HMAC con el SECRET_KEY de la app. El
#  payload es el ID del poblador, asi el frontend puede guardarlo en
#  localStorage y el backend lo verifica en cada peticion.
# ===================================================================

import os
from typing import Optional
from itsdangerous import URLSafeSerializer, BadSignature

_SALT = "poblador-presupuesto-participativo"


def _serializer() -> URLSafeSerializer:
    secret = os.getenv("SECRET_KEY", "dev-secret-key")
    return URLSafeSerializer(secret, salt=_SALT)


def issue_poblador_token(poblador_id: int) -> str:
    """Emite un token firmado para el poblador autenticado."""
    return _serializer().dumps({"pid": int(poblador_id)})


def read_poblador_token(token: str) -> Optional[int]:
    """Valida el token y retorna el ID del poblador, o None si no es valido."""
    if not token:
        return None
    try:
        data = _serializer().loads(token)
        pid = data.get("pid")
        return int(pid) if pid is not None else None
    except (BadSignature, ValueError, TypeError):
        return None
