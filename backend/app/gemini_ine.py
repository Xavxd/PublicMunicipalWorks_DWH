import json
import logging
import os
import base64
import requests
import time
from functools import lru_cache

logger = logging.getLogger(__name__)

GEMINI_SUPPORTED_MIME = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
}

# Modelos confirmados funcionales en 2026 (ordenados por preferencia)
# Se verifican dinámicamente contra la API para descartar los que no existan
_FALLBACK_MODELS = [
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-1.5-flash-latest",
]

INE_PROMPT = """Analiza esta imagen de una credencial para votar (INE/IFE) mexicana.
Examina AMBOS lados si es posible determinarlos, pero el reverso contiene la clave de elector.

Responde ÚNICAMENTE con un objeto JSON con exactamente estas llaves (sin texto adicional, sin markdown):
{
  "es_ine": true/false,
  "estado": "nombre o número del estado visible",
  "municipio": "nombre o número del municipio visible",
  "clave_elector": "la clave de elector de 18 caracteres alfanuméricos, vacía si no es visible",
  "pertenece_a_temascaltepec": true/false
}

Reglas:
- "es_ine": true si la imagen muestra una INE/IFE legítima mexicana (cualquier lado)
- "pertenece_a_temascaltepec": true SOLO si estado=Estado de México (15 o "México") Y municipio=Temascaltepec (086)
- Si no puedes leer algún campo con certeza, usa cadena vacía ""
- No agregues explicaciones, solo el JSON puro"""


class GeminiConfigError(RuntimeError):
    pass


@lru_cache(maxsize=1)
def _get_available_models(api_key: str) -> list:
    """
    Consulta la API de Gemini para obtener modelos reales disponibles.
    Se cachea para no repetir en cada request.
    """
    if not api_key:
        return []

    url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key.strip()}"
    try:
        resp = requests.get(url, timeout=15)
        if resp.status_code != 200:
            logger.warning(f"[Gemini] No se pudo listar modelos: HTTP {resp.status_code}")
            return []

        data = resp.json()
        available = {m["name"].replace("models/", "") for m in data.get("models", [])}
        logger.info(f"[Gemini] Modelos disponibles: {available}")

        # Filtrar nuestros fallbacks por los que realmente existen
        valid = [m for m in _FALLBACK_MODELS if m in available]
        if not valid:
            # Si ninguno coincide exactamente, buscar alternativas comunes
            for alt in ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash"]:
                if any(alt in name for name in available):
                    # Encontrar el nombre exacto
                    for name in available:
                        if alt in name:
                            valid.append(name)
                            break
        return valid

    except Exception as e:
        logger.warning(f"[Gemini] Error listando modelos: {e}")
        return []


def _build_payload(image_b64: str, mime_type: str) -> dict:
    return {
        "contents": [{
            "parts": [
                {"text": INE_PROMPT},
                {
                    "inlineData": {
                        "mimeType": mime_type,
                        "data": image_b64
                    }
                }
            ]
        }],
        "generationConfig": {
            "temperature": 0.0,
            "maxOutputTokens": 512,
        },
        "safetySettings": [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
        ]
    }


def _call_gemini(api_key: str, model: str, image_b64: str, mime_type: str, max_retries: int = 2) -> str:
    """
    Llama a Gemini con un solo modelo.
    Maneja 429 con backoff exponencial.
    """
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    payload = _build_payload(image_b64, mime_type)
    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": api_key.strip()
    }

    for attempt in range(max_retries + 1):
        try:
            response = requests.post(url, json=payload, headers=headers, timeout=30)

            # 429: Too Many Requests → esperar y reintentar
            if response.status_code == 429:
                wait = 2 ** attempt  # 1s, 2s
                logger.warning(f"[Gemini] 429 en {model}, esperando {wait}s...")
                time.sleep(wait)
                continue

            # 404: Modelo no existe → no reintentar, fallar rápido
            if response.status_code == 404:
                raise GeminiConfigError(f"Modelo '{model}' no existe (404)")

            if response.status_code == 400:
                err = response.text[:500]
                raise GeminiConfigError(f"Bad request: {err}")

            if response.status_code != 200:
                err = response.text[:300]
                raise GeminiConfigError(f"HTTP {response.status_code}: {err}")

            resp_data = response.json()
            candidates = resp_data.get("candidates", [])

            if not candidates:
                block_reason = resp_data.get("promptFeedback", {}).get("blockReason", "desconocida")
                raise GeminiConfigError(f"Sin candidatos (bloqueado: {block_reason})")

            candidate = candidates[0]
            finish_reason = candidate.get("finishReason", "STOP")

            if finish_reason in ("SAFETY", "RECITATION", "OTHER"):
                raise GeminiConfigError(f"Respuesta bloqueada por {finish_reason}")

            parts = candidate.get("content", {}).get("parts", [])
            if not parts:
                raise GeminiConfigError("Respuesta vacía del modelo")

            text = parts[0].get("text", "")
            if text:
                logger.info(f"[Gemini] Éxito con {model}")
                return text

            raise GeminiConfigError("Campo 'text' vacío")

        except requests.exceptions.Timeout:
            if attempt < max_retries:
                time.sleep(1)
                continue
            raise GeminiConfigError(f"Timeout con {model}")
        except requests.exceptions.RequestException as e:
            if attempt < max_retries:
                time.sleep(1)
                continue
            raise GeminiConfigError(f"Error de red: {e}")

    raise GeminiConfigError(f"Agotados reintentos con {model}")


def _normalize_mime(mime_type: str) -> str:
    if not mime_type:
        return "image/jpeg"
    m = mime_type.lower().strip()
    if m in ("image/jpg", "image/jpe"):
        return "image/jpeg"
    if m in ("image/heic", "image/heif"):
        return "image/jpeg"
    if m in GEMINI_SUPPORTED_MIME:
        return m
    return "image/jpeg"


def _parse_json_response(text: str) -> dict:
    if not text or not text.strip():
        return {}

    cleaned = text.strip()

    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(cleaned[start:end + 1])
        except json.JSONDecodeError:
            pass

    logger.warning(f"[Gemini] No se pudo parsear JSON de: {cleaned[:200]}")
    return {}


def _bool_field(value) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in ("true", "1", "si", "sí", "yes", "verdadero")
    if isinstance(value, int):
        return value != 0
    return bool(value)


def verify_ine_image(image_bytes: bytes, mime_type: str = "image/jpeg") -> dict:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise GeminiConfigError(
            "GEMINI_API_KEY no está configurada. "
            "Agrégala en Render → Environment."
        )

    if not image_bytes:
        raise GeminiConfigError("La imagen llegó vacía.")

    exact_mime = _normalize_mime(mime_type)

    try:
        image_b64 = base64.b64encode(image_bytes).decode("utf-8")
    except Exception as exc:
        raise GeminiConfigError(f"Error al codificar imagen: {exc}") from exc

    # Obtener modelos disponibles (cacheado)
    available_models = _get_available_models(api_key)
    models_to_try = available_models if available_models else _FALLBACK_MODELS

    logger.info(f"[Gemini] Intentando modelos: {models_to_try}")

    last_error = None
    for model in models_to_try:
        try:
            text = _call_gemini(api_key, model, image_b64, exact_mime)
            parsed = _parse_json_response(text)
            break
        except GeminiConfigError as e:
            last_error = str(e)
            logger.warning(f"[Gemini] Modelo {model} falló: {last_error}")
            # Si el error es 404, no seguir intentando otros modelos si ya sabemos
            # que la API key no tiene acceso. Pero si es 429, el backoff ya manejó.
            if "no existe (404)" in last_error:
                continue
            continue
    else:
        raise GeminiConfigError(
            f"No se pudo procesar la INE. Último error: {last_error}"
        )

    clave_raw = str(parsed.get("clave_elector") or "").strip().upper()
    clave = clave_raw if len(clave_raw) == 18 and clave_raw.isalnum() else ""

    return {
        "es_ine": _bool_field(parsed.get("es_ine")),
        "estado": str(parsed.get("estado") or "").strip(),
        "municipio": str(parsed.get("municipio") or "").strip(),
        "clave_elector": clave,
        "pertenece_a_temascaltepec": _bool_field(parsed.get("pertenece_a_temascaltepec")),
    }
