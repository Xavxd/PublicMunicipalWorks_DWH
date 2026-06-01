"""
backend/routes/imagenes.py
═══════════════════════════════════════════════════════════════════
GESTIÓN DE EVIDENCIA FOTOGRÁFICA DE INFORMES
- Subida (multipart/form-data) y borrado: solo supervisores autenticados
- Listado público: cualquier visitante (para el mapa público)
- Listado autenticado: usuarios con sesión activa
═══════════════════════════════════════════════════════════════════
"""

import uuid
from flask import Blueprint, request, make_response
from sqlalchemy.exc import IntegrityError

from app.database import db
from app.helpers import ok, created, bad_request, not_found, db_error_response
from app.models import Informe, ImagenInforme
from app import r2_storage
from .decorators import require_auth

imagenes_bp = Blueprint("imagenes", __name__)


# ════════════════════════════════════════════════════════════════
#  CORS helper (replica del patrón en public.py)
# ════════════════════════════════════════════════════════════════

def _cors(resp):
    if isinstance(resp, tuple):
        resp = make_response(resp[0], resp[1] if len(resp) > 1 else 200)
    resp.headers.add("Access-Control-Allow-Origin", "*")
    resp.headers.add("Access-Control-Allow-Headers", "Content-Type, Authorization")
    resp.headers.add("Access-Control-Allow-Methods", "GET, OPTIONS")
    return resp


def _cors_preflight():
    return _cors(make_response())


# ════════════════════════════════════════════════════════════════
#  SUBIR IMÁGENES A UN INFORME
# ════════════════════════════════════════════════════════════════

@imagenes_bp.route("/api/informes/<informe_id>/imagenes", methods=["POST"])
@require_auth("supervisor")
def upload_imagenes_informe(informe_id, current_user):
    """
    Sube una o varias imágenes (campo 'imagenes' multipart) al informe indicado.

    Reglas:
      - El supervisor autenticado debe ser el dueño del informe.
      - Solo JPG/PNG, máx 10 MB por archivo.
      - Las imágenes se almacenan en Cloudflare R2 bajo
        obras/{id_obra}/reportes/{año}-{mes}/{timestamp}_{slug}.{ext}.

    Estrategia atómica:
      1. Validar TODOS los archivos primero.
      2. Subir TODOS a R2. Si uno falla, limpiar los ya subidos y abortar.
      3. Insertar TODOS en BD en una sola transacción. Si falla,
         hacer rollback y limpiar de R2 (best-effort).

    Respuesta:
      { "success": true, "data": [<imagen>, ...], "message": "..." }
    """
    informe_id = informe_id.strip()

    # ── Validar existencia y propiedad del informe ──
    informe = (
        Informe.query
        .filter(db.func.trim(Informe.id_informe) == informe_id)
        .first()
    )
    if not informe:
        return not_found(f"Informe '{informe_id}' no encontrado.")

    if informe.codigo_supervisor.strip() != current_user["id"].strip():
        return bad_request("No tienes permiso para adjuntar imágenes a este informe.")

    # ── Validar archivos recibidos ──
    files = request.files.getlist("imagenes")
    if not files:
        # Compatibilidad: aceptar también un solo archivo bajo 'imagen' o 'file'
        single = request.files.get("imagen") or request.files.get("file")
        if single:
            files = [single]

    files = [f for f in files if f and f.filename]
    if not files:
        return bad_request("No se recibió ningún archivo. Usa el campo 'imagenes'.")

    obra_id = informe.id_obra.strip()
    anio    = informe.ano_infor
    mes     = (informe.mes or "").strip() or "1"

    # ── FASE 1: Validar todos los archivos ANTES de tocar R2 ──
    for f in files:
        valid, err = r2_storage.validate_image(f)
        if not valid:
            return bad_request(err)

    # ── FASE 2: Subir a R2 (si uno falla, limpiar los ya subidos) ──
    uploaded_r2 = []          # Lista de (object_key, file_storage) para rollback
    r2_results  = []          # Lista de dicts para insertar en BD

    try:
        for f in files:
            object_key = r2_storage.build_object_key(
                id_obra=obra_id, anio=anio, mes=mes, original_name=f.filename
            )
            content_type = (f.mimetype or "image/jpeg").lower()

            # Tamaño: usar content_length si está disponible (ya validado)
            size = getattr(f, "content_length", None) or 0
            if not size:
                try:
                    f.stream.seek(0, 2)
                    size = f.stream.tell()
                    f.stream.seek(0)
                except Exception:
                    size = 0

            public_url = r2_storage.upload_fileobj(
                file_storage=f, object_key=object_key, content_type=content_type
            )

            uploaded_r2.append(object_key)
            r2_results.append({
                "id_imagen": str(uuid.uuid4()),
                "id_informe": informe_id,
                "url_publica": public_url,
                "ruta_r2": object_key,
                "nombre_original": f.filename,
                "tipo_mime": content_type,
                "tamano_bytes": int(size),
            })

    except RuntimeError as exc:
        # R2 no configurado u otro error de boto3
        _limpiar_r2(uploaded_r2)
        return bad_request(str(exc))
    except Exception as exc:
        _limpiar_r2(uploaded_r2)
        return db_error_response(exc)

    # ── FASE 3: Insertar en BD de forma atómica ──
    saved = []
    try:
        for r in r2_results:
            img = ImagenInforme(**r)
            db.session.add(img)
            saved.append(img)

        db.session.commit()
        return created(
            [img.to_dict() for img in saved],
            f"{len(saved)} imagen(es) subida(s) al informe."
        )

    except IntegrityError as exc:
        db.session.rollback()
        _limpiar_r2(uploaded_r2)
        return bad_request("Error de integridad: posible duplicado de ID.")
    except Exception as exc:
        db.session.rollback()
        _limpiar_r2(uploaded_r2)
        return db_error_response(exc)


def _limpiar_r2(object_keys):
    """Best-effort: elimina objetos de R2 si la transacción de BD falló."""
    for key in object_keys:
        try:
            r2_storage.delete_object(key)
        except Exception:
            pass


# ════════════════════════════════════════════════════════════════
#  LISTAR IMÁGENES DE UN INFORME (autenticado)
# ════════════════════════════════════════════════════════════════

@imagenes_bp.route("/api/informes/<informe_id>/imagenes", methods=["GET"])
@require_auth("supervisor", "director", "secretaria", "proyectista")
def list_imagenes_informe(informe_id, current_user):
    """Lista las imágenes de un informe (cualquier usuario autenticado)."""
    informe_id = informe_id.strip()
    try:
        imagenes = (
            ImagenInforme.query
            .filter(db.func.trim(ImagenInforme.id_informe) == informe_id)
            .order_by(ImagenInforme.fecha_subida.asc())
            .all()
        )
        return ok([img.to_dict() for img in imagenes])
    except Exception as exc:
        return db_error_response(exc)


# ════════════════════════════════════════════════════════════════
#  LISTAR IMÁGENES (PÚBLICO — sin autenticación, para el mapa)
# ════════════════════════════════════════════════════════════════

@imagenes_bp.route("/api/public/informes/<informe_id>/imagenes",
                   methods=["GET", "OPTIONS"])
def list_imagenes_publico(informe_id):
    if request.method == "OPTIONS":
        return _cors_preflight()
    try:
        imagenes = (
            ImagenInforme.query
            .filter(db.func.trim(ImagenInforme.id_informe) == informe_id.strip())
            .order_by(ImagenInforme.fecha_subida.asc())
            .all()
        )
        return _cors(ok([img.to_dict() for img in imagenes]))
    except Exception as exc:
        return _cors(db_error_response(exc))


@imagenes_bp.route("/api/public/obras/<obra_id>/imagenes",
                   methods=["GET", "OPTIONS"])
def list_imagenes_obra_publico(obra_id):
    """
    Devuelve todas las imágenes de todos los informes de una obra.
    Útil para galerías en el mapa público.
    Se usa JOIN en lugar de subquery en Python para eficiencia.
    """
    if request.method == "OPTIONS":
        return _cors_preflight()
    try:
        obra_id = obra_id.strip()
        # JOIN directo: imagenes_informe ↔ informes filtrado por obra
        imagenes = (
            ImagenInforme.query
            .join(Informe, ImagenInforme.id_informe == Informe.id_informe)
            .filter(db.func.trim(Informe.id_obra) == obra_id)
            .order_by(ImagenInforme.fecha_subida.desc())
            .limit(200)          # Límite de seguridad para evitar payloads gigantes
            .all()
        )
        return _cors(ok([img.to_dict() for img in imagenes]))
    except Exception as exc:
        return _cors(db_error_response(exc))


# ════════════════════════════════════════════════════════════════
#  ELIMINAR IMAGEN (supervisor dueño o director)
# ════════════════════════════════════════════════════════════════

@imagenes_bp.route("/api/imagenes/<id_imagen>", methods=["DELETE"])
@require_auth("supervisor", "director")
def delete_imagen(id_imagen, current_user):
    """
    Borra una imagen del bucket R2 y su metadato en BD.

    Estrategia atómica:
      1. Buscar imagen en BD.
      2. Validar propiedad (si es supervisor).
      3. Borrar fila de BD y commit.
      4. Borrar de R2 (si falla, no importa: la BD ya es consistente).

    El supervisor solo puede borrar imágenes de sus propios informes.
    """
    try:
        img = ImagenInforme.query.filter_by(id_imagen=id_imagen.strip()).first()
        if not img:
            return not_found("Imagen no encontrada.")

        # Validar propiedad si es supervisor (director puede borrar cualquiera)
        if current_user["role"].lower() == "supervisor":
            # JOIN eficiente: verificamos en una sola query
            informe = (
                Informe.query
                .filter(db.func.trim(Informe.id_informe) == img.id_informe.strip())
                .first()
            )
            if not informe or informe.codigo_supervisor.strip() != current_user["id"].strip():
                return bad_request("No tienes permiso para borrar esta imagen.")

        ruta_r2 = img.ruta_r2  # Guardar antes de borrar la fila

        # 1) Borrar metadato de BD primero (transacción reversible)
        db.session.delete(img)
        db.session.commit()

        # 2) Borrar de R2 (best-effort; si falla, la BD ya es consistente)
        try:
            r2_storage.delete_object(ruta_r2)
        except RuntimeError as exc:
            # Loggear pero no fallar al usuario; el objeto huérfano en R2
            # puede limpiarse después vía lifecycle rules o script de mantenimiento
            print(f"[WARN] No se pudo eliminar objeto de R2: {ruta_r2} — {exc}")

        return ok(message="Imagen eliminada.")

    except Exception as exc:
        db.session.rollback()
        return db_error_response(exc)
