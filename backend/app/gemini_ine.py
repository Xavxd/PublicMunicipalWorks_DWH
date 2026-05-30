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

    # 1. Normalización estricta del MIME Type
    exact_mime = mime_type.lower().strip() if mime_type else "image/jpeg"
    if exact_mime == "image/jpg":
        exact_mime = "image/jpeg"

    # 2. Convertir los bytes binarios directamente a una cadena Base64
    try:
        image_b64 = base64.b64encode(image_bytes).decode("utf-8")
    except Exception as exc:
        raise GeminiConfigError("No se pudieron procesar los bytes de la imagen.") from exc

    # 3. Endpoint oficial de producción
    url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"

    # 4. Construir el payload usando camelCase (obligatorio para la API REST de Google)
    payload = {
        "contents": [{
            "parts": [
                {"text": INE_PROMPT},
                {
                    "inlineData": {          # ← CORREGIDO: inlineData (camelCase)
                        "mimeType": exact_mime,   # ← CORREGIDO: mimeType
                        "data": image_b64
                    }
                }
            ]
        }],
        "generationConfig": {               # ← CORREGIDO: generationConfig
            "temperature": 0.0,
            "responseMimeType": "application/json"   # ← CORREGIDO: responseMimeType
        }
    }

    # 5. Autenticación por cabeceras para soportar llaves con formato AQ.
    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": api_key.strip()
    }

    # 6. Realizar la petición POST hacia Google
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=20)
        
        if response.status_code != 200:
            print(f"[GOOGLE API ERROR DIAGNOSTIC] -> Status: {response.status_code} -> Body: {response.text}")
            
        response.raise_for_status()
        resp_data = response.json()
        
        # Validar que la respuesta contenga candidatos
        candidates = resp_data.get("candidates", [])
        if not candidates:
            raise GeminiConfigError("La API no devolvió candidatos. Revisa tu prompt o la imagen.")
        
        text = candidates[0]["content"]["parts"][0]["text"]
    except Exception as e:
        error_details = ""
        try:
            if 'response' in locals() and response.text:
                error_details = f" -> Detalle original de Google: {response.text}"
        except:
            pass
        raise GeminiConfigError(f"Error en la comunicacion con la API de Google: {str(e)}{error_details}")

    if not text:
        return {
            "es_ine": False,
            "estado": "",
            "municipio": "",
            "clave_elector": "",
            "pertenece_a_temascaltepec": False
        }

    # 7. Limpieza de bloques Markdown del string devuelto
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()

    # 8. Intentar parsear el JSON directamente
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

    # 9. Normalizar respuestas booleanas
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
