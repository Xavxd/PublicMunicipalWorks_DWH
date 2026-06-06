# backend/app/r2_storage.py
# ════════════════════════════════════════════════════════════════
#  CLIENTE CLOUDFLARE R2 (S3-COMPATIBLE) PARA EVIDENCIA FOTOGRÁFICA
#  Maneja upload y delete de imágenes de informes de obra.
#  Lectura: vía URL pública del bucket (no requiere SDK).
# ════════════════════════════════════════════════════════════════

import os
import re
import unicodedata
from datetime import datetime, timezone
from typing import Tuple

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError


# ── Configuración desde variables de entorno (Render) ────────────
R2_ACCESS_KEY_ID     = os.getenv("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY")
R2_ENDPOINT_URL      = os.getenv("R2_ENDPOINT_URL")
R2_BUCKET_NAME       = os.getenv("R2_BUCKET_NAME")
R2_PUBLIC_URL        = (os.getenv("R2_PUBLIC_URL") or "").rstrip("/")

# Límites y validación
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024            # 10 MB
ALLOWED_MIME_TYPES  = {"image/jpeg", "image/png"}
ALLOWED_EXTENSIONS  = {"jpg", "jpeg", "png"}


# ── Cliente boto3 perezoso (se construye al primer uso) ──────────
_client = None


def _is_configured() -> bool:
    return all([
        R2_ACCESS_KEY_ID,
        R2_SECRET_ACCESS_KEY,
        R2_ENDPOINT_URL,
        R2_BUCKET_NAME,
        R2_PUBLIC_URL,
    ])


def get_client():
    """Devuelve un cliente boto3 configurado para Cloudflare R2."""
    global _client
    if _client is not None:
        return _client

    if not _is_configured():
        raise RuntimeError(
            "R2 no configurado. Define las variables R2_ACCESS_KEY_ID, "
            "R2_SECRET_ACCESS_KEY, R2_ENDPOINT_URL, R2_BUCKET_NAME y R2_PUBLIC_URL."
        )

    _client = boto3.client(
        "s3",
        endpoint_url=R2_ENDPOINT_URL,
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        region_name="auto",                       # R2 ignora la región
        config=Config(
            signature_version="s3v4",
            retries={"max_attempts": 3, "mode": "standard"},
        ),
    )
    return _client


# ── Utilidades de saneamiento ────────────────────────────────────

def _slugify(text: str) -> str:
    """Convierte un nombre a un slug seguro para usar en rutas R2."""
    if not text:
        return "imagen"
    # Normaliza acentos
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    # Reemplaza no alfanuméricos por guiones bajos
    text = re.sub(r"[^a-zA-Z0-9._-]+", "_", text).strip("._-")
    return text.lower() or "imagen"


def _ext_from_filename(filename: str) -> str:
    if not filename or "." not in filename:
        return ""
    return filename.rsplit(".", 1)[1].lower()


def validate_image(file_storage) -> Tuple[bool, str]:
    """
    Valida tamaño, MIME y extensión del archivo subido.
    Devuelve (ok, mensaje_error).
    """
    if not file_storage or not getattr(file_storage, "filename", ""):
        return False, "Archivo vacío o sin nombre."

    ext = _ext_from_filename(file_storage.filename)
    if ext not in ALLOWED_EXTENSIONS:
        return False, f"Extensión no permitida: .{ext}. Solo se aceptan JPG y PNG."

    mime = (file_storage.mimetype or "").lower()
    if mime not in ALLOWED_MIME_TYPES:
        return False, f"Tipo MIME no permitido: {mime}. Solo se aceptan image/jpeg y image/png."

    # ── Medir tamaño del stream de forma robusta ──
    # Werkzeug/Flask usa SpooledTemporaryFile; content_length a veces es 0
    # o None aunque el archivo tenga datos. Usamos seek/tell directamente.
    stream = file_storage.stream
    try:
        # Guardar posición actual (por si acaso)
        pos = stream.tell() if hasattr(stream, "tell") else 0
        # Ir al final
        stream.seek(0, 2)
        size = stream.tell()
        # Volver al inicio (o a la posición original si no era 0)
        stream.seek(0)
    except (OSError, ValueError, AttributeError):
        # Si el stream no soporta seek, intentar leer para verificar que no está vacío
        try:
            first_byte = stream.read(1)
            stream.seek(0)
            size = 1 if first_byte else 0
        except Exception:
            return False, "No se pudo determinar el tamaño del archivo."

    if size <= 0:
        return False, "Archivo vacío."
    if size > MAX_FILE_SIZE_BYTES:
        return False, f"El archivo excede el límite de {MAX_FILE_SIZE_BYTES // (1024*1024)} MB."

    return True, ""


# ── Construcción de la ruta dentro del bucket ────────────────────

def build_object_key(id_obra: str, anio: int, mes: str | int, original_name: str) -> str:
    """
    Estructura tipo data lake (Hive-style) dentro del bucket:
      obras/{id_obra}/reportes/{año}-{mes}/{timestamp}_{slug}.{ext}

    Nota: el nombre del bucket en R2 es "docobraspublicas". Su URL pública
    ya incluye ese segmento vía R2_PUBLIC_URL. El object_key es la ruta
    relativa DENTRO del bucket, por lo que no lleva ese prefijo.
    """
    ext = _ext_from_filename(original_name) or "jpg"
    base = original_name.rsplit(".", 1)[0] if "." in original_name else original_name
    safe = _slugify(base)
    ts   = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S_%f")
    mes_str = str(mes).strip().zfill(2)
    return f"obras/{id_obra.strip()}/reportes/{int(anio)}-{mes_str}/{ts}_{safe}.{ext}"


def build_public_url(object_key: str) -> str:
    return f"{R2_PUBLIC_URL}/{object_key}"


# ── Operaciones de alto nivel ────────────────────────────────────

def upload_fileobj(file_storage, object_key: str, content_type: str) -> str:
    """
    Sube el archivo al bucket R2.
    Devuelve la URL pública (vía R2_PUBLIC_URL).
    """
    client = get_client()
    # Reasegura que el stream esté al inicio
    try:
        file_storage.stream.seek(0)
    except Exception:
        pass

    client.upload_fileobj(
        Fileobj=file_storage.stream,
        Bucket=R2_BUCKET_NAME,
        Key=object_key,
        ExtraArgs={
            "ContentType": content_type or "application/octet-stream",
        },
    )
    return build_public_url(object_key)


def delete_object(object_key: str) -> bool:
    """Elimina un objeto del bucket. True si tuvo éxito o ya no existía."""
    client = get_client()
    try:
        client.delete_object(Bucket=R2_BUCKET_NAME, Key=object_key)
        return True
    except ClientError as exc:
        # Si el objeto ya no existe lo tomamos como éxito
        code = exc.response.get("Error", {}).get("Code", "")
        if code in ("NoSuchKey", "404"):
            return True
        raise
