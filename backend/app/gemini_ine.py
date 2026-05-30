# app/gemini_ine.py
# ===================================================================
#  VALIDACION EFIMERA DE INE CON GEMINI 1.5 FLASH
# -------------------------------------------------------------------
#  Recibe los bytes binarios de una foto del reverso de la INE,
#  los procesa en memoria (io.BytesIO) y los envia al modelo
#  gemini-1.5-flash. La imagen NUNCA se persiste en disco.
#
#  Devuelve un dict con la estructura esperada por el frontend:
#    {
#      "es_ine": bool,
#      "estado": str | int,
#      "municipio": str | int,
#      "clave_elector": str,
#      "pertenece_a_temascaltepec": bool
#    }
#
#  Variables de entorno requeridas:
#    GEMINI_API_KEY  -> se inyecta desde Render.
# ===================================================================

import io
import json
import os
import re
from typing import Optional

INE_PROMPT = """Analiza esta imagen de una identificacion oficial mexicana (INE).
Extrae la informacion y responde UNICAMENTE con un objeto JSON con las siguientes llaves:
- "es_ine": (true si es una credencial INE legitima por el reverso, false si es cualquier otra cosa).
- "estado": (numero o nombre del estado que aparece en la seccion ESTADO).
- "municipio": (numero o nombre del municipio en la seccion MUNICIPIO).
- "clave_elector": (la clave de elector de 18 caracteres).
- "pertenece_a_temascaltepec": (true si el estado es Estado de Mexico/15 y el municipio es Temascaltepec/086, de lo contrario false).

No agregues texto de saludo ni explicacion, solo el JSON puro."""


_JSON_BLOCK_RE = re.compile(r"\{.*\}", re.DOTALL)


def _extract_json(text: str) -> dict:
    """Extrae el primer bloque JSON del texto devuelto por Gemini."""
    if not text:
        return {}
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\n?", "", text)
        text = re.sub(r"\n?```\s*$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = _JSON_BLOCK_RE.search(text)
        if not match:
            return {}
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return {}


def _normalize(parsed: dict) -> dict:
    """Sanea el dict devuelto por la IA a un esquema consistente."""
    def _bool(v):
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            return v.strip().lower() in ("true", "1", "si", "sí", "yes")
        return bool(v)

    clave = parsed.get("clave_elector") or ""
    if not isinstance(clave, str):
        clave = str(clave)
    clave = clave.strip().upper()

    return {
        "es_ine": _bool(parsed.get("es_ine")),
        "estado": parsed.get("estado", ""),
        "municipio": parsed.get("municipio", ""),
        "clave_elector": clave,
        "pertenece_a_temascaltepec": _bool(parsed.get("pertenece_a_temascaltepec")),
    }


class GeminiConfigError(RuntimeError):
    """Se lanza cuando GEMINI_API_KEY no esta configurada."""


def verify_ine_image(image_bytes: bytes, mime_type: str = "image/jpeg") -> dict:
    """Envia la imagen a Gemini Flash y retorna el JSON normalizado.

    La imagen se procesa SOLO en RAM via io.BytesIO. Si el caller necesita
    persistir temporalmente (por restricciones del SDK), debe eliminar el
    archivo con os.remove() inmediatamente despues de la llamada.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise GeminiConfigError(
            "GEMINI_API_KEY no configurada en el entorno. "
            "Anadela en las variables de Render."
        )

    try:
        import google.generativeai as genai
    except ImportError as exc:
        raise GeminiConfigError(
            "El paquete 'google-generativeai' no esta instalado en el backend."
        ) from exc

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-1.5-flash")

    buf = io.BytesIO(image_bytes)
    buf.seek(0)
    image_part = {"mime_type": mime_type or "image/jpeg", "data": buf.getvalue()}

    response = model.generate_content(
        [INE_PROMPT, image_part],
        generation_config={
            "temperature": 0.0,
            "response_mime_type": "application/json",
        },
    )

    text: Optional[str] = None
    try:
        text = response.text
    except Exception:
        try:
            candidates = getattr(response, "candidates", None) or []
            if candidates:
                parts = getattr(candidates[0].content, "parts", []) or []
                text = "".join(getattr(p, "text", "") or "" for p in parts)
        except Exception:
            text = None

    parsed = _extract_json(text or "")
    result = _normalize(parsed)

    buf.close()
    del image_bytes
    del buf

    return result
