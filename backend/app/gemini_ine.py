import json
import logging
import os
import base64
import requests
import time

logger = logging.getLogger(__name__)

GEMINI_SUPPORTED_MIME = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
}

# ORDEN CRÍTICO: 1.5-flash primero porque es el más estable y disponible
# gemini-2.0-flash puede requerir permisos especiales o estar en beta cerrada
_FALLBACK_MODELS = [
    "gemini-1.5-flash",        # ✅ Más estable, cuota gratuita generosa
    "gemini-1.5-flash-latest", # ✅ Alias del anterior
    "gemini-2.0-flash",        # ⚠️ Puede requerir acceso especial
    "gemini-1.5-pro",          # ✅ Fallback de último recurso (más lento pero funciona)
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


def _call_gemini_single(api_key: str, model: str, image_b64: str, mime_type: str) -> str:
    """
    Un solo intento SIN reintentos automáticos (excepto 429).
    Loguea TODO para diagnóstico.
    """
    # Probar ambos métodos de auth: header y query param
    urls = [
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key.strip()}",
    ]

    payload = _build_payload(image_b64, mime_type)
    headers = {"Content-Type": "application/json"}

    for url in urls:
        try:
            response = requests.post(url, json=payload, headers=headers, timeout=30)

            # LOG DETALLADO para diagnóstico
            logger.warning(
                f"[Gemini] {model} | Status: {response.status_code} | "
                f"Body: {response.text[:400]}"
            )

            # 429: esperar 3 segundos y reintentar UNA vez
            if response.status_code == 429:
                logger.warning(f"[Gemini] 429 en {model}, esperando 3s...")
                time.sleep(3)
                response = requests.post(url, json=payload, headers=headers, timeout=30)
                logger.warning(
                    f"[Gemini] {model} reintento | Status: {response.status_code} | "
                    f"Body: {response.text[:400]}"
                )
                if response.status_code == 429:
                    raise GeminiConfigError(f"Cuota agotada (429) para {model}")

            if response.status_code == 404:
                raise GeminiConfigError(f"Modelo '{model}' no existe (404)")

            if response.status_code == 400:
                err = response.text[:500]
                raise GeminiConfigError(f"Bad request ({model}): {err}")

            if response.status_code == 403:
                err = response.text[:500]
                raise GeminiConfigError(f"API key sin permisos para {model} (403): {err}")

            if response.status_code != 200:
                err = response.text[:300]
                raise GeminiConfigError(f"HTTP {response.status_code} ({model}): {err}")

            resp_data = response.json()
            candidates = resp_data.get("candidates", [])

            if not candidates:
                block_reason = resp_data.get("promptFeedback", {}).get("blockReason", "desconocida")
                raise GeminiConfigError(f"Sin candidatos ({model}, bloqueado: {block_reason})")

            candidate = candidates[0]
            finish_reason = candidate.get("finishReason", "STOP")

            if finish_reason in ("SAFETY", "RECITATION", "OTHER"):
                raise GeminiConfigError(f"Respuesta bloqueada ({model}): {finish_reason}")

            parts = candidate.get("content", {}).get("parts", [])
            if not parts:
                raise GeminiConfigError(f"Respuesta vacía ({model})")

            text = parts[0].get("text", "")
            if text:
                logger.info(f"[Gemini] ÉXITO con {model}")
                return text

            raise GeminiConfigError(f"Texto vacío ({model})")

        except requests.exceptions.Timeout:
            raise GeminiConfigError(f"Timeout con {model}")
        except requests.exceptions.RequestException as e:
            raise GeminiConfigError(f"Error de red ({model}): {e}")

    raise GeminiConfigError(f"Fallo total con {model}")


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

    logger.info(f"[Gemini] Iniciando verificación INE. Modelos a probar: {_FALLBACK_MODELS}")

    last_error = None
    for model in _FALLBACK_MODELS:
        try:
            text = _call_gemini_single(api_key, model, image_b64, exact_mime)
            parsed = _parse_json_response(text)
            break
        except GeminiConfigError as e:
            last_error = str(e)
            logger.warning(f"[Gemini] {last_error}")
            # Si es 404 o 403, saltar inmediatamente al siguiente modelo
            if "no existe (404)" in last_error or "sin permisos" in last_error:
                continue
            # Si es 429 (cuota), también saltar al siguiente modelo
            if "Cuota agotada" in last_error:
                continue
            # Para otros errores, también intentar siguiente modelo
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
