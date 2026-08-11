"""
generar_dataset_obras.py
=============================================================================
Simula la ejecución mensual de obras públicas municipales y emite un registro
por obra y periodo de observación, con la causa latente de cada anomalía
guardada aparte como verdad de terreno.

Por qué se reescribió
---------------------
La versión anterior inyectaba anomalías escribiendo directamente los valores
que el detector busca: la clase «inconsistencia» forzaba el avance físico a
5-25 % mientras el presupuestal quedaba en 100 % por construcción, que es
exactamente el criterio C3; la clase «fantasma» ponía el avance en 0 y doblaba
el presupuesto, otra vez C3; y la clase «retraso» sorteaba el retraso en
[120, 365] días contra un criterio C2 de «más de 120 días». El recall perfecto
que se obtenía en esas tres clases estaba escrito en el generador, no medido.
Un revisor lo señaló, y tenía razón.

Aquí las anomalías son estados latentes de un proceso de obra —un contratista
poco productivo, un precio inflado en la adjudicación, pagos que se adelantan
al avance, una obra que se detiene— y lo que el detector ve son las
consecuencias observables de ese estado, no el estado. Las magnitudes se
sortean de distribuciones que **se solapan con las normales**, de modo que
algunas anomalías son indetectables y algunas obras sanas parecen anómalas.
Ésa es la condición para que la evaluación diga algo.

La etiqueta latente viaja en `causa_latente` y ningún detector la observa.

Uso
---
    python scripts/evaluacion/generar_dataset_obras.py              # semilla 42
    python scripts/evaluacion/generar_dataset_obras.py --semilla 7
    python scripts/evaluacion/generar_dataset_obras.py --prevalencia 0.08
"""
import argparse
import json
import os

import numpy as np

# ---------------------------------------------------------------------------
# Base territorial. El índice de desarrollo es una covariable del contexto,
# no una señal de anomalía: entra en el dataset porque el detector de la
# línea base lo usa, y porque una obra en una comunidad remota avanza más
# despacio sin que eso sea irregular.
# ---------------------------------------------------------------------------
COMUNIDADES = [
    'Temascaltepec de González', 'San Juan de las Huertas', 'San José Ixtapan',
    'San Diego del Nichi', 'San Francisco Oxtotilpan', 'San Lucas',
    'San Pedro de los Baños', 'Santa Ana Zicatecoyan', 'Santa María Nativitas',
    'Santiago Tlacotepec', 'El Carmen', 'La Ciénega', 'El Rincón',
    'La Cofradía', 'El Cerrito', 'La Presa', 'El Aguacate', 'La Estancia',
    'El Capulín', 'La Laguna', 'El Ocote', 'La Palmilla', 'El Potrero',
    'La Raya', 'El Salto', 'La Soledad', 'El Tule', 'La Venta',
    'El Zapote', 'Los Alamos', 'Los Arrayanes', 'Los Cedros',
    'Los Pinos', 'Rancho Viejo', 'San Agustín', 'San Antonio',
    'San Bartolo', 'San Cristóbal', 'San Felipe', 'San Isidro',
    'San José', 'San Miguel', 'San Nicolás', 'San Pablo',
    'San Pedro', 'San Rafael', 'San Sebastián', 'Santa Cruz',
    'Santa Elena', 'Santa Lucía', 'Santa Rosa', 'Santiago',
    'Santo Domingo', 'Valle de Bravo', 'Centro',
]

IDS = {
    'Temascaltepec de González': 65, 'San Juan de las Huertas': 42,
    'San José Ixtapan': 38, 'San Diego del Nichi': 35,
    'San Francisco Oxtotilpan': 40, 'San Lucas': 45,
    'San Pedro de los Baños': 48, 'Santa Ana Zicatecoyan': 32,
    'Santa María Nativitas': 50, 'Santiago Tlacotepec': 55,
    'El Carmen': 52, 'La Ciénega': 30, 'El Rincón': 28,
    'La Cofradía': 33, 'El Cerrito': 36, 'La Presa': 41,
    'El Aguacate': 29, 'La Estancia': 37, 'El Capulín': 31,
    'La Laguna': 34, 'El Ocote': 27, 'La Palmilla': 39,
    'El Potrero': 35, 'La Raya': 43, 'El Salto': 38,
    'La Soledad': 36, 'El Tule': 40, 'La Venta': 44,
    'El Zapote': 42, 'Los Alamos': 46, 'Los Arrayanes': 47,
    'Los Cedros': 48, 'Los Pinos': 49, 'Rancho Viejo': 41,
    'San Agustín': 43, 'San Antonio': 45, 'San Bartolo': 44,
    'San Cristóbal': 46, 'San Felipe': 47, 'San Isidro': 48,
    'San José': 50, 'San Miguel': 51, 'San Nicolás': 49,
    'San Pablo': 52, 'San Pedro': 53, 'San Rafael': 54,
    'San Sebastián': 55, 'Santa Cruz': 56, 'Santa Elena': 57,
    'Santa Lucía': 58, 'Santa Rosa': 59, 'Santiago': 60,
    'Santo Domingo': 61, 'Valle de Bravo': 75, 'Centro': 68,
}

# tipo de obra -> (coste base en miles de pesos, duración prevista en meses)
TIPOS_OBRA = {
    'Pavimentación de calles': (2500, 8),
    'Construcción de muro de contención': (3500, 10),
    'Rehabilitación de camino rural': (1800, 6),
    'Construcción de drenaje pluvial': (2200, 9),
    'Ampliación de red de agua potable': (2800, 10),
    'Construcción de escuela primaria': (4500, 14),
    'Remodelación de plaza principal': (1500, 6),
    'Construcción de centro de salud': (3800, 12),
    'Mejoramiento de vivienda': (800, 4),
    'Construcción de cancha deportiva': (1200, 5),
    'Instalación de alumbrado público': (600, 3),
    'Construcción de puente peatonal': (2000, 7),
    'Rehabilitación de edificio municipal': (2500, 8),
    'Construcción de mercado municipal': (3200, 12),
    'Pavimentación de avenida principal': (3500, 10),
    'Construcción de sistema de alcantarillado': (2800, 11),
    'Remodelación de parque': (1000, 5),
    'Construcción de biblioteca pública': (2200, 8),
    'Mejoramiento de camino vecinal': (1500, 6),
    'Construcción de módulo de salud': (1800, 7),
}

CAUSAS = ('sobreprecio', 'baja_productividad', 'pago_adelantado', 'abandono',
          'obra_fantasma')
ANIOS = (2020, 2021, 2022, 2023, 2024)

# Meses de lluvia en la sierra: la obra avanza más despacio y no es irregular.
MESES_LLUVIA = (6, 7, 8, 9)


def sortear_causa(rng, prevalencia):
    """La causa latente. Ningún detector la observa."""
    if rng.random() >= prevalencia:
        return None
    return CAUSAS[rng.integers(len(CAUSAS))]


def simular_obra(rng, comunidad, tipo, anio, prevalencia):
    """Simula una obra mes a mes y devuelve sus periodos observados.

    Lo que devuelve son magnitudes observables —avance físico, presupuesto
    ejercido, retraso acumulado—. La causa latente se adjunta sólo como
    verdad de terreno.
    """
    coste_base, meses_previstos = TIPOS_OBRA[tipo]
    ids = IDS[comunidad]
    causa = sortear_causa(rng, prevalencia)

    # --- adjudicación -----------------------------------------------------
    # Ruido de precio normal: obras iguales cuestan distinto por terreno,
    # acarreo y temporada. El sobreprecio se sortea de una distribución que
    # SE SOLAPA con este ruido, así que un sobreprecio pequeño es, en los
    # datos, indistinguible de una obra cara legítima.
    ruido_precio = rng.lognormal(mean=0.0, sigma=0.22)
    factor_ids = 1 + (ids - 50) * 0.006
    presupuesto = coste_base * factor_ids * ruido_precio
    if causa == 'sobreprecio':
        presupuesto *= rng.lognormal(mean=np.log(1.25), sigma=0.30)

    # --- productividad ----------------------------------------------------
    # Fracción de obra que la constructora cierra en un mes tipo. Las
    # comunidades remotas avanzan algo más despacio sin que sea irregular.
    productividad = rng.normal(1.0, 0.18) * (0.92 + 0.0016 * ids)
    if causa == 'baja_productividad':
        productividad *= rng.uniform(0.35, 0.85)
    productividad = max(0.15, productividad)

    # Severidad del desvío de pagos: la mayoría son leves —indistinguibles
    # del ruido de tesorería— y unos pocos son descarados. Sin esa cola no
    # habría con qué evaluar el criterio de inconsistencia.
    severidad_pago = rng.beta(1.4, 3.0) if causa == 'pago_adelantado' else 0.0

    # Obra fantasma: contratada, pagada y esencialmente no ejecutada. Es un
    # fenómeno real de la obra pública, no un umbral: lo que se fija es que la
    # obra no se hace, y el avance que se reporta se sortea en un rango que
    # cruza el umbral del criterio, de modo que unas se ven y otras no.
    techo_fantasma = rng.uniform(0.02, 0.45) if causa == 'obra_fantasma' else None

    mes_abandono = None
    if causa == 'abandono':
        # Se detiene en cualquier punto: pararse al 85 % es casi invisible,
        # pararse al 20 % salta a la vista. Las dos cosas ocurren.
        mes_abandono = int(np.ceil(meses_previstos * rng.uniform(0.20, 0.90)))

    # --- ejecución mes a mes ---------------------------------------------
    avance = 0.0
    ejercido = 0.0
    # Anticipo de arranque: entre el 10 % y el 30 % del contrato, normal en
    # obra pública mexicana. Sin él, el avance financiero nunca adelanta al
    # físico y la clase «pago adelantado» sería trivial.
    anticipo = rng.uniform(0.10, 0.30)
    ejercido += anticipo

    mes_inicio = int(rng.integers(1, 13))
    filas = []
    limite = int(meses_previstos * 2.5) + 6
    for m in range(1, limite + 1):
        mes_calendario = (mes_inicio + m - 2) % 12 + 1
        if techo_fantasma is not None and avance >= techo_fantasma:
            paso = 0.0
        elif mes_abandono is not None and m > mes_abandono:
            paso = 0.0
        else:
            estacion = 0.62 if mes_calendario in MESES_LLUVIA else 1.0
            paso = (1.0 / meses_previstos) * productividad * estacion
            paso *= max(0.0, rng.normal(1.0, 0.25))
        avance = min(1.0, avance + paso)

        # El gasto persigue al avance con retardo y ruido; el anticipo se
        # amortiza contra la obra ejecutada.
        objetivo = anticipo + (1 - anticipo) * avance
        if techo_fantasma is not None:
            # Se paga contra obra inexistente: el gasto sigue al calendario
            # contractual, no al avance.
            objetivo = min(1.0, anticipo + (1 - anticipo) * (m / meses_previstos))
        ejercido += (objetivo - ejercido) * rng.uniform(0.45, 0.85)
        if causa == 'pago_adelantado':
            # Se paga contra obra no ejecutada: el pago se acerca al total
            # del contrato en proporción a la severidad, quede o no obra por
            # hacer.
            ejercido += severidad_pago * (1.0 - ejercido) * rng.uniform(0.3, 0.7)
        ejercido = min(1.35, max(0.0, ejercido))

        # Retraso acumulado: cuánto tiempo lleva de más frente al plan.
        meses_planeados = avance * meses_previstos
        retraso_dias = max(0.0, (m - meses_planeados) * 30.0)

        # Se observa cada dos meses, como el reporte bimestral.
        if m % 2 == 0 and (avance > 0.02 or mes_abandono is not None):
            filas.append({
                'comunidad': comunidad,
                'tipo_obra': tipo,
                'anio': anio,
                'bimestre': ((mes_calendario - 1) // 2) + 1,
                'mes_ejecucion': m,
                'presupuesto_miles_pesos': round(presupuesto, 2),
                'presupuesto_ejercido': round(presupuesto * ejercido, 2),
                'avance_fisico_porcentaje': round(avance * 100, 2),
                'avance_presupuestal_porcentaje': round(ejercido * 100, 2),
                'dias_retraso': int(round(retraso_dias)),
                'ids_comunidad': ids,
                'es_anomalia_real': causa is not None,
                'causa_latente': causa,
            })
        if avance >= 0.999:
            break
        # Una obra parada deja de reportar avance al cabo de unos meses; sin
        # este corte las paradas dominarían el conjunto por pura duración.
        if (mes_abandono is not None and m > mes_abandono + 6) or            (techo_fantasma is not None and m > meses_previstos + 2):
            break
    return filas


def generar(semilla, prevalencia, obras_por_comunidad=(6, 14)):
    rng = np.random.default_rng(semilla)
    tipos = list(TIPOS_OBRA)
    dataset = []
    for comunidad in COMUNIDADES:
        n = int(rng.integers(*obras_por_comunidad))
        for _ in range(n):
            tipo = tipos[rng.integers(len(tipos))]
            anio = int(ANIOS[rng.integers(len(ANIOS))])
            dataset.extend(simular_obra(rng, comunidad, tipo, anio, prevalencia))
    return dataset


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--semilla", type=int, default=42)
    ap.add_argument("--prevalencia", type=float, default=0.15)
    ap.add_argument("--salida", default=os.path.join("datos_sinteticos",
                                                     "obras_temascaltepec.json"))
    args = ap.parse_args()

    dataset = generar(args.semilla, args.prevalencia)
    os.makedirs(os.path.dirname(args.salida), exist_ok=True)
    with open(args.salida, "w", encoding="utf-8") as f:
        json.dump(dataset, f, indent=2, ensure_ascii=False)

    positivos = sum(r["es_anomalia_real"] for r in dataset)
    print(f"semilla {args.semilla}, prevalencia pedida {args.prevalencia:.0%}")
    print(f"{len(dataset)} registros obra-periodo en {len(COMUNIDADES)} comunidades")
    print(f"{positivos} anómalos ({positivos/len(dataset)*100:.2f}%)")
    reparto = {}
    for r in dataset:
        if r["causa_latente"]:
            reparto[r["causa_latente"]] = reparto.get(r["causa_latente"], 0) + 1
    for causa, n in sorted(reparto.items()):
        print(f"  {causa:20} {n}")
    print(f"\nguardado en {args.salida}")


if __name__ == "__main__":
    main()
