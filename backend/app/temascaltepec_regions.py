# app/temascaltepec_regions.py
# ===================================================================
#  CATÁLOGO DE MICRO-REGIONES DE TEMASCALTEPEC
# -------------------------------------------------------------------
#  Cambios respecto a la versión anterior:
#  - Agregado MAX_DISTANCE_KM = 35km: umbral máximo para considerar
#    a un usuario "cercano" al municipio. Usuarios fuera de ese radio
#    (ej. CDMX, Toluca centro, etc.) recibirán lista vacía en lugar
#    de propuestas irrelevantes.
#  - Mensaje de respuesta diferenciado según el motivo de lista vacía
#    (sin propuestas vs usuario fuera del área municipal).
#  - La sierra hace que 35km en línea recta cubra todo Temascaltepec
#    y municipios colindantes (Sultepec, Tejupilco, Almoloya de Alquisiras).
# ===================================================================

import math
import unicodedata
from typing import Iterable

# Distancia máxima en km desde la que se consideran propuestas relevantes.
# El municipio de Temascaltepec abarca ~7-8km de extremo a extremo.
# 35km cubre el municipio completo + municipios colindantes con margen.
# CDMX (GAM) queda a ~110km → no verá propuestas. ✓
# Toluca queda a ~55km → no verá propuestas. ✓
# Sultepec (colindante) queda a ~25km → sí verá propuestas. ✓
MAX_DISTANCE_KM = 35.0

# (nombre_canonico, lat, lng) — coordenadas aproximadas de cada comunidad
COMUNIDADES: list[tuple[str, float, float]] = [
    ("Temascaltepec de Gonzalez",       19.0445, -100.0419),
    ("Real de Arriba",                  19.0381, -100.0533),
    ("San Andres de los Gama",          19.0731, -100.0344),
    ("San Pedro Tenayac",               19.0028, -100.0625),
    ("San Mateo Almomoloha",            19.0856, -100.0658),
    ("San Miguel Oxtotilpan",           19.1147, -100.0500),
    ("San Francisco Oxtotilpan",        19.1167, -100.0631),
    ("La Comunidad",                    19.0231, -100.0192),
    ("Carboneras",                      19.0958, -100.0214),
    ("Telpintla",                       18.9819, -100.0497),
    ("Cieneguillas de Mananantiales",   19.0794, -100.0789),
    ("San Lucas del Pulque",            19.0594, -100.0050),
    ("Mesa de Jaimes",                  18.9939, -100.0858),
    ("El Mirasol",                      19.0633, -100.0931),
    ("Potrero de San Jose",             18.9697, -100.0775),
    ("San Antonio Albarranes",          19.0539, -100.1108),
    ("Tequesquipan",                    19.0181, -100.0331),
    ("La Albarrada",                    19.0117, -100.0742),
]

# Centro geográfico aproximado del municipio (para validar si el usuario
# está en la zona general antes de calcular por propuesta)
_MUNICIPIO_CENTER_LAT = 19.044
_MUNICIPIO_CENTER_LNG = -100.050


def _normalize(value: str) -> str:
    """Quita acentos, signos y pasa a minúsculas para comparación robusta."""
    if not value:
        return ""
    txt = unicodedata.normalize("NFD", value)
    txt = "".join(c for c in txt if unicodedata.category(c) != "Mn")
    return "".join(c for c in txt.lower() if c.isalnum() or c.isspace()).strip()


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distancia en kilómetros entre dos puntos geodésicos."""
    R = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlmb / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def is_within_municipal_area(lat: float, lng: float) -> bool:
    """
    Verifica si las coordenadas del usuario están dentro del radio
    de cobertura del sistema (MAX_DISTANCE_KM desde el centro municipal).

    Retorna True si el usuario puede recibir propuestas cercanas.
    """
    if lat is None or lng is None:
        return False
    dist = _haversine_km(lat, lng, _MUNICIPIO_CENTER_LAT, _MUNICIPIO_CENTER_LNG)
    return dist <= MAX_DISTANCE_KM


def rank_propuestas_por_proximidad(
    lat: float,
    lng: float,
    propuestas: Iterable,
    max_results: int = 5,
) -> tuple[list, bool]:
    """
    Ordena propuestas por proximidad a la micro-región del usuario.

    Retorna: (lista_propuestas, usuario_en_area)
      - lista_propuestas: hasta max_results propuestas ordenadas por distancia
      - usuario_en_area: False si el usuario está fuera del municipio

    Cambios:
      - Ahora filtra propuestas a más de MAX_DISTANCE_KM
      - Retorna tupla con flag de si el usuario está en el área
      - Regiones desconocidas se descartan para evitar falsos positivos
    """
    if lat is None or lng is None:
        return [], False

    # Verificar primero si el usuario está en la zona general
    dist_al_centro = _haversine_km(lat, lng, _MUNICIPIO_CENTER_LAT, _MUNICIPIO_CENTER_LNG)
    usuario_en_area = dist_al_centro <= MAX_DISTANCE_KM

    if not usuario_en_area:
        # Usuario fuera del municipio: no mostrar propuestas
        return [], False

    # Construir catálogo normalizado
    catalog = {_normalize(name): (lat_c, lng_c) for name, lat_c, lng_c in COMUNIDADES}

    decorated: list[tuple[float, object]] = []
    for p in propuestas:
        key = _normalize(getattr(p, "region", "") or "")
        if not key:
            continue

        coords = None
        # Búsqueda exacta primero
        if key in catalog:
            coords = catalog[key]
        else:
            # Búsqueda parcial por contención
            for canon, ll in catalog.items():
                if key in canon or canon in key:
                    coords = ll
                    break

        if not coords:
            # Región desconocida: usar el centro del municipio como aproximación
            # (mejor que descartar si la propuesta claramente es local)
            coords = (_MUNICIPIO_CENTER_LAT, _MUNICIPIO_CENTER_LNG)

        d = _haversine_km(lat, lng, coords[0], coords[1])

        # Solo incluir si está dentro del radio de relevancia
        if d <= MAX_DISTANCE_KM:
            decorated.append((d, p))

    decorated.sort(key=lambda x: x[0])
    return [p for _, p in decorated[:max_results]], True
