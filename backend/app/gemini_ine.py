# app/gemini_ine.py
# ===================================================================
#  VALIDACIÓN EFÍMERA DE INE CON GEMINI 1.5 FLASH (VÍA API REST v1)
# ===================================================================

import json
import os
import base64
import requests

INE_PROMPT = """Analiza esta imagen de una identificacion oficial mexicana (INE).
Extrae la informacion y responde UNICAMENTE con un objeto JSON con las siguientes llaves:
- "es_ine": (true si es una credencial INE legitima por el reverso, false si es cualquier otra cosa).
- "estado": (numero o nombre del estado que aparece en la seccion ESTADO).
- "municipio": (numero o nombre del municipio en la seccion MUNICIPIO).
- "clave_elector": (la clave de elector de 18 caracteres).
- "pertenece_a_temascaltepec": (true si el estado es Estado de Mexico/15 y el municipio es Temascaltepec/086, de lo contrario false).

No agregues texto de saludo ni explicacion, solo el JSON puro."""


class GeminiConfigError(RuntimeError):
    """Se lanza cuando GEMINI_API_KEY no está configurada o la API falla."""


def verify_ine_image(image_bytes: bytes, mime_type: str = "image/jpeg") -> dict:
    """Envia la imagen a Gemini Flash mediante la API REST estable y retorna el JSON normalizado."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise GeminiConfigError("GEMINI_API_KEY no configurada en las variables de entorno de Render.")

    # 1. Convertir los bytes binarios directamente a una cadena Base64
    try:
        image_b64 = base64.b64encode(image_bytes).decode("utf-8")
    except Exception as exc:
        raise GeminiConfigError("No se pudieron procesar los bytes de la imagen.") from exc

    # 2. Endpoint oficial de producción (v1 estable)
    url = f"https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key={api_key}"

    # 3. Construir el payload JSON compatible con la API nativa de Google
    payload = {
        "contents": [{
            "parts": [
                {"text": INE_PROMPT},
                {
                    "inlineData": {
                        "mimeType": mime_type or "image/jpeg",
                        "data": image_b64
                    }
                }
            ]
        }],
        "generationConfig": {
            "temperature": 0.0,
            "responseMimeType": "application/json"
        }
    }

    headers = {"Content-Type": "application/json"}

    # 4. Realizar la petición POST hacia Google
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=20)
        response.raise_for_status()
        resp_data = response.json()
        text = resp_data["candidates"][0]["content"]["parts"][0]["text"]
    except Exception as e:
        raise GeminiConfigError(f"Error en la comunicacion con la API de Google: {str(e)}")

    if not text:
        return {
            "es_ine": False,
            "estado": "",
            "municipio": "",
            "clave_elector": "",
            "pertenece_a_temascaltepec": False
        }

    # 5. Limpieza segura de bloques Markdown sin usar librerías propensas a errores de sintaxis
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()

    # 6. Intentar parsear el JSON directamente o buscar llaves si viene con basura
    try:
        parsed = json.loads(cleaned)
    except Exception:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1:
            try:
                parsed = json.loads(cleaned[start:end+1])
            except Exception:
                parsed = {}
        else:
            parsed = {}

    # 7. Normalizar respuestas
    def _bool(v):
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            return v.strip().lower() in ("true", "1", "si", "sí", "yes")
        return bool(v)

    clave = str(parsed.get("clave_elector") or "").strip().upper()

    return {
        "es_ine": _bool(parsed.get("es_ine")),
        "estado": parsed.get("estado", ""),
        "municipio": parsed.get("municipio", ""),
        "clave_elector": clave,
        "pertenece_a_temascaltepec": _bool(parsed.get("pertenece_a_temascaltepec")),
    }
