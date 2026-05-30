# app/quadrimestre.py
# ===================================================================
#  CONTROL DE PERIODOS CUATRIMESTRALES (Presupuesto Participativo)
# -------------------------------------------------------------------
#  Los creditos de voto se resetean cada 4 meses, alineados con las
#  revisiones de propuestas de la presidencia municipal.
#
#  Esquema:
#    * Enero      a Abril       => 'YYYY-T1'
#    * Mayo       a Agosto      => 'YYYY-T2'
#    * Septiembre a Diciembre   => 'YYYY-T3'
# ===================================================================

from datetime import date, datetime


def periodo_actual(reference: date | datetime | None = None) -> str:
    """Devuelve el codigo del cuatrimestre activo, p. ej. '2026-T1'.

    El parametro `reference` es util para pruebas; si no se pasa,
    se usa la fecha del sistema en zona horaria local del servidor.
    """
    if reference is None:
        ref = date.today()
    elif isinstance(reference, datetime):
        ref = reference.date()
    else:
        ref = reference

    month = ref.month
    if 1 <= month <= 4:
        tri = "T1"
    elif 5 <= month <= 8:
        tri = "T2"
    else:
        tri = "T3"

    return f"{ref.year}-{tri}"


CREDITOS_POR_PERIODO = 3
"""Maximo de votos por poblador en un mismo cuatrimestre."""
