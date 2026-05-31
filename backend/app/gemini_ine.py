import json
import logging
import os
import base64
import requests

logger = logging.getLogger(__name__)

# MIME types que Gemini acepta via inlineData (HEIC NO está soportado)
GEMINI_SUPPORTED_MIME = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
}

# Modelos a intentar en orden (fallback automático)
_GEMINI_MODELS = [
    "gemini-2.0-flash",        # Primero: más rápido, visión nativa, recomendado
    "gemini-2.0-flash-001",    # Versión estable de 2.0
    "gemini-2.0-flash-lite",   # Ligero, buena alternativa
    "gemini-1.5-flash-latest", # Fallback: última 1.5 disponible
    "gemini-1.5-flash-002",    # Última versión estable de 1.5
    # EXCLUIDO: "gemini-1.5-flash" → eliminado por Google (causa error 404)
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
    """Se lanza cuando GEMINI_API_KEY no está configurada o la API falla."""


def _build_payload(image_b64: str, mime_type: str) -> dict:
    """Construye el payload para la API de Gemini."""
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
            # NO incluir responseMimeType: causa conflictos con algunos modelos
        },
        "safetySettings": [
            {
                "category": "HARM_CATEGORY_HARASSMENT",
                "threshold": "BLOCK_NONE"
            },
            {
                "category": "HARM_CATEGORY_HATE_SPEECH",
                "threshold": "BLOCK_NONE"
            },
            {
                "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                "threshold": "BLOCK_NONE"
            },
            {
                "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                "threshold": "BLOCK_NONE"
            }
        ]
    }


def _call_gemini(api_key: str, model: str, image_b64: str, mime_type: str) -> str:
    """
    Llama a la API de Gemini con el modelo especificado.
    Retorna el texto de la respuesta o lanza GeminiConfigError.
    """
    # Intentar tanto v1 como v1beta para compatibilidad máxima
    endpoints = [
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        f"https://generativelanguage.googleapis.com/v1/models/{model}:generateContent",
    ]

    payload = _build_payload(image_b64, mime_type)
    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": api_key.strip()
    }

    last_error = None
    for url in endpoints:
        try:
            response = requests.post(url, json=payload, headers=headers, timeout=30)

            if response.status_code == 404:
                # Modelo no disponible en este endpoint, intentar siguiente
                last_error = f"Modelo {model} no disponible (404)"
                continue

            if response.status_code == 400:
                err_body = response.text[:500]
                logger.warning(f"[Gemini] 400 con {model}: {err_body}")
                last_error = f"Bad request con {model}: {err_body}"
                continue

            if response.status_code != 200:
                err_body = response.text[:300]
                logger.warning(f"[Gemini] HTTP {response.status_code} con {model}: {err_body}")
                last_error = f"HTTP {response.status_code} con {model}"
                continue

            resp_data = response.json()

            # Verificar que hay candidatos
            candidates = resp_data.get("candidates", [])
            if not candidates:
                # Puede ser que el prompt fue bloqueado
                block_reason = resp_data.get("promptFeedback", {}).get("blockReason", "desconocida")
                last_error = f"Sin candidatos (bloqueado: {block_reason})"
                logger.warning(f"[Gemini] Sin candidatos con {model}: {last_error}")
                continue

            candidate = candidates[0]

            # Verificar finishReason
            finish_reason = candidate.get("finishReason", "STOP")
            if finish_reason in ("SAFETY", "RECITATION", "OTHER"):
                last_error = f"Respuesta bloqueada por {finish_reason}"
                logger.warning(f"[Gemini] {last_error} con {model}")
                continue

            # Extraer texto
            content = candidate.get("content", {})
            parts = content.get("parts", [])
            if not parts:
                last_error = "Respuesta vacía del modelo"
                continue

            text = parts[0].get("text", "")
            if text:
                logger.info(f"[Gemini] Respuesta exitosa con {model} via {url}")
                return text

            last_error = "Campo 'text' vacío en la respuesta"

        except requests.exceptions.Timeout:
            last_error = f"Timeout con {model}"
            logger.warning(f"[Gemini] {last_error}")
        except requests.exceptions.RequestException as e:
            last_error = str(e)
            logger.warning(f"[Gemini] RequestException con {model}: {last_error}")

    raise GeminiConfigError(f"Todos los endpoints fallaron. Último error: {last_error}")


def _normalize_mime(mime_type: str) -> str:
    """Normaliza el MIME type a uno soportado por Gemini."""
    if not mime_type:
        return "image/jpeg"
    m = mime_type.lower().strip()
    # Normalizar variantes
    if m in ("image/jpg", "image/jpe"):
        return "image/jpeg"
    # HEIC/HEIF no soportado: tratar como JPEG (el servidor ya valida antes)
    if m in ("image/heic", "image/heif"):
        return "image/jpeg"
    if m in GEMINI_SUPPORTED_MIME:
        return m
    # Fallback seguro
    return "image/jpeg"


def _parse_json_response(text: str) -> dict:
    """
    Extrae y parsea el JSON de la respuesta del modelo.
    Maneja bloques de markdown y texto adicional.
    """
    if not text or not text.strip():
        return {}

    cleaned = text.strip()

    # Remover bloques de código markdown
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        # Remover primera línea (```json o ```)
        if lines:
            lines = lines[1:]
        # Remover última línea si es ```
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()

    # Intento directo
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Buscar el objeto JSON dentro del texto
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
    """Convierte un valor a booleano de forma robusta."""
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in ("true", "1", "si", "sí", "yes", "verdadero")
    if isinstance(value, int):
        return value != 0
    return bool(value)


def verify_ine_image(image_bytes: bytes, mime_type: str = "image/jpeg") -> dict:
    """
    Envía la imagen a Gemini y retorna el análisis normalizado.

    Parámetros:
        image_bytes: bytes de la imagen (procesados en RAM, nunca en disco)
        mime_type: tipo MIME reportado por el cliente

    Retorna dict con:
        es_ine, estado, municipio, clave_elector, pertenece_a_temascaltepec
    """
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise GeminiConfigError(
            "GEMINI_API_KEY no está configurada en las variables de entorno. "
            "Agrégala en el panel de Render → Environment."
        )

    if not image_bytes:
        raise GeminiConfigError("La imagen llegó vacía.")

    # Normalizar MIME type
    exact_mime = _normalize_mime(mime_type)

    # Convertir imagen a base64
    try:
        image_b64 = base64.b64encode(image_bytes).decode("utf-8")
    except Exception as exc:
        raise GeminiConfigError(f"Error al codificar la imagen en base64: {exc}") from exc

    # Intentar modelos en orden de preferencia
    last_error = None
    for model in _GEMINI_MODELS:
        try:
            text = _call_gemini(api_key, model, image_b64, exact_mime)
            parsed = _parse_json_response(text)
            break
        except GeminiConfigError as e:
            last_error = str(e)
            logger.warning(f"[Gemini] Modelo {model} falló: {last_error}")
            continue
    else:
        # Ningún modelo funcionó
        raise GeminiConfigError(
            f"No se pudo obtener respuesta de ningún modelo de Gemini. "
            f"Detalle: {last_error}"
        )

    # Limpiar y validar clave de elector
    clave_raw = str(parsed.get("clave_elector") or "").strip().upper()
    # La clave de elector mexicana es alfanumérica, 18 chars
    clave = clave_raw if len(clave_raw) == 18 and clave_raw.isalnum() else ""

    return {
        "es_ine": _bool_field(parsed.get("es_ine")),
        "estado": str(parsed.get("estado") or "").strip(),
        "municipio": str(parsed.get("municipio") or "").strip(),
        "clave_elector": clave,
        "pertenece_a_temascaltepec": _bool_field(parsed.get("pertenece_a_temascaltepec")),
    }
