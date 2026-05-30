import json
import os
import re
import base64
import requests
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
        text = re.sub(r"^
http://googleusercontent.com/immersive_entry_chip/0
