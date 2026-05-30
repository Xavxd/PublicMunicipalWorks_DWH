# app/temascaltepec_regions.py
# ===================================================================
#  CATALOGO DE MICRO-REGIONES DE TEMASCALTEPEC
# -------------------------------------------------------------------
#  La sierra de Temascaltepec hace que la distancia en linea recta
#  pueda enganar (dos puntos cercanos en coordenadas pueden estar
#  separados por un cerro). Para el endpoint "Cercanas a ti" usamos
#  un catalogo curado de comunidades con sus coordenadas aproximadas;
#  asi mapeamos al usuario a la micro-region mas cercana y filtramos
#  propuestas por el nombre normalizado de la region.
# ===================================================================

import math
import unicodedata
from typing import Iterable

# (nombre_canonico, lat, lng)
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


def _normalize(value: str) -> str:
    """Quita acentos, signos y pasa a minusculas."""
    if not value:
        return ""
    txt = unicodedata.normalize("NFD", value)
    txt = "".join(c for c in txt if unicodedata.category(c) != "Mn")
    return "".join(c for c in txt.lower() if c.isalnum() or c.isspace()).strip()


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distancia en kilometros entre dos puntos (lat/lng en grados)."""
    R = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlmb / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def rank_propuestas_por_proximidad(
    lat: float,
    lng: float,
    propuestas: Iterable,
    max_results: int = 5,
) -> list:
    """Ordena propuestas por proximidad a la micro-region del usuario.

    `propuestas` debe ser iterable de objetos con atributo `region`.
    Devuelve a lo mas `max_results` propuestas, ordenadas por la
    distancia (en km) entre la comunidad informada en la propuesta y
    el punto del usuario. Las regiones desconocidas se descartan para
    evitar falsos positivos por la topografia de la sierra.
    """
    if lat is None or lng is None:
        return []

    catalog = {_normalize(name): (lat_c, lng_c) for name, lat_c, lng_c in COMUNIDADES}

    decorated: list[tuple[float, object]] = []
    for p in propuestas:
        key = _normalize(getattr(p, "region", "") or "")
        if not key:
            continue
        coords = None
        if key in catalog:
            coords = catalog[key]
        else:
            for canon, ll in catalog.items():
                if key in canon or canon in key:
                    coords = ll
                    break
        if not coords:
            continue
        d = _haversine_km(lat, lng, coords[0], coords[1])
        decorated.append((d, p))

    decorated.sort(key=lambda x: x[0])
    return [p for _, p in decorated[:max_results]]
