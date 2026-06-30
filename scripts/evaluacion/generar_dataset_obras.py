"""
Generador de Dataset Sintético para Evaluación de Detección de Anomalías en Obras Públicas
============================================================================================
"""

import json
import random
import numpy as np
from datetime import datetime, timedelta

random.seed(42)
np.random.seed(42)

# ============================================================
# DATOS BASE REALISTAS DE TEMASCALTEPEC, EDOMEX
# ============================================================

COMUNIDADES_TEMASCALTEPEC = [
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
    'Santo Domingo', 'Valle de Bravo', 'Centro'
]

# Índice de desarrollo socioeconómico por comunidad (0-100, simulado basado en CONEVAL)
IDS_COMUNIDADES = {
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
    'Santo Domingo': 61, 'Valle de Bravo': 75, 'Centro': 68
}

TIPOS_OBRA = [
    'Pavimentación de calles', 'Construcción de muro de contención',
    'Rehabilitación de camino rural', 'Construcción de drenaje pluvial',
    'Ampliación de red de agua potable', 'Construcción de escuela primaria',
    'Remodelación de plaza principal', 'Construcción de centro de salud',
    'Mejoramiento de vivienda', 'Construcción de cancha deportiva',
    'Instalación de alumbrado público', 'Construcción de puente peatonal',
    'Rehabilitación de edificio municipal', 'Construcción de mercado municipal',
    'Pavimentación de avenida principal', 'Construcción de sistema de alcantarillado',
    'Remodelación de parque', 'Construcción de biblioteca pública',
    'Mejoramiento de camino vecinal', 'Construcción de módulo de salud'
]

CONSTRUCTORAS = [
    'Constructora del Valle S.A. de C.V.', 'Obras y Proyectos México S.A.',
    'Infraestructura Moderna S.A. de C.V.', 'Constructora Toluca S.A.',
    'Edificaciones del Estado S.A. de C.V.', 'Proyectos Urbanos México S.A.',
    'Constructora Temascaltepec S.A. de C.V.', 'Obras Públicas Avanzadas S.A.',
    'Infraestructura Rural S.A. de C.V.', 'Constructora del Altiplano S.A.'
]

FUENTES_FINANCIAMIENTO = [
    {'id': 'FISM-2024', 'grado': 'Federal', 'programa': 'FISM'},
    {'id': 'FORTAMUN-2024', 'grado': 'Federal', 'programa': 'FORTAMUN'},
    {'id': 'RAMO-33-2024', 'grado': 'Federal', 'programa': 'Ramo 33'},
    {'id': 'ESTATAL-2024', 'grado': 'Estatal', 'programa': 'Fondo Estatal'},
    {'id': 'MUNICIPAL-2024', 'grado': 'Municipal', 'programa': 'Recursos Propios'}
]

ANIOS = [2020, 2021, 2022, 2023, 2024]
BIMESTRES = [1, 2, 3, 4, 5, 6]


def generar_consumo_base(comunidad, tipo_obra, anio, bimestre):
    """
    Genera consumo presupuestal base realista para una obra en un período dado.
    
    Factores:
    - IDS de la comunidad (mayor IDS = mayor presupuesto)
    - Tipo de obra (pavimentación > alumbrado)
    - Estacionalidad (bimestre 3-4 = estiaje = más obras)
    - Variación aleatoria normal
    - Tendencia de crecimiento anual
    """
    ids = IDS_COMUNIDADES[comunidad]
    
    # Presupuesto base por tipo de obra (miles de pesos)
    presupuesto_base_tipo = {
        'Pavimentación de calles': 2500,
        'Construcción de muro de contención': 3500,
        'Rehabilitación de camino rural': 1800,
        'Construcción de drenaje pluvial': 2200,
        'Ampliación de red de agua potable': 2800,
        'Construcción de escuela primaria': 4500,
        'Remodelación de plaza principal': 1500,
        'Construcción de centro de salud': 3800,
        'Mejoramiento de vivienda': 800,
        'Construcción de cancha deportiva': 1200,
        'Instalación de alumbrado público': 600,
        'Construcción de puente peatonal': 2000,
        'Rehabilitación de edificio municipal': 2500,
        'Construcción de mercado municipal': 3200,
        'Pavimentación de avenida principal': 3500,
        'Construcción de sistema de alcantarillado': 2800,
        'Remodelación de parque': 1000,
        'Construcción de biblioteca pública': 2200,
        'Mejoramiento de camino vecinal': 1500,
        'Construcción de módulo de salud': 1800
    }
    
    presupuesto_base = presupuesto_base_tipo.get(tipo_obra, 2000)
    
    # Ajuste por IDS (comunidades con mayor IDS reciben más presupuesto)
    ajuste_ids = 1 + (ids - 50) * 0.008  # ±40% de variación
    
    # Estacionalidad: más obras en bimestres 3-4 (estiaje, menos lluvias)
    estacionalidad = 1.15 if bimestre in [3, 4] else 0.95
    
    # Tendencia de crecimiento anual (3% por año)
    anio_factor = 1 + (anio - 2020) * 0.03
    
    # Variación aleatoria normal (±20%)
    variacion = np.random.normal(1.0, 0.20)
    
    # Presupuesto final (en miles de pesos)
    presupuesto = presupuesto_base * ajuste_ids * estacionalidad * anio_factor * variacion
    
    return max(500, presupuesto)  # Mínimo 500 mil pesos


def inyectar_anomalias(presupuesto, avance_fisico, dias_retraso, probabilidad_anomalia=0.15):
    """
    Inyecta anomalías con una probabilidad dada.
    Tipos de anomalía:
    - Sobrecosto (presupuesto 1.5-3x mayor)
    - Retraso extremo (>120 días)
    - Avance físico inconsistente (alto presupuesto, bajo avance)
    - Obra fantasma (presupuesto ejercido, sin avance)
    """
    es_anomalia = False
    tipo_anomalia = None
    
    if random.random() < probabilidad_anomalia:
        tipo_anomalia = random.choice(['sobrecosto', 'retraso', 'inconsistencia', 'fantasma'])
        es_anomalia = True
        
        if tipo_anomalia == 'sobrecosto':
            factor = random.uniform(1.5, 3.0)
            presupuesto = presupuesto * factor
        elif tipo_anomalia == 'retraso':
            dias_retraso = random.randint(120, 365)
        elif tipo_anomalia == 'inconsistencia':
            avance_fisico = random.randint(5, 25)  # Muy bajo avance
        else:  # fantasma
            avance_fisico = 0
            presupuesto = presupuesto * 2
    
    return presupuesto, avance_fisico, dias_retraso, es_anomalia, tipo_anomalia


def main():
    print("=" * 70)
    print("GENERADOR DE DATASET SINTÉTICO - OBRAS PÚBLICAS TEMASCALTEPEC")
    print("=" * 70)
    print()
    
    dataset = []
    total_registros = 0
    total_anomalias = 0
    
    print("Generando datos para 55 comunidades...")
    
    for comunidad in COMUNIDADES_TEMASCALTEPEC:
        # Número de obras por comunidad (varía entre 15 y 35)
        num_obras = random.randint(15, 35)
        
        print(f"  {comunidad}: {num_obras} obras")
        
        for i in range(num_obras):
            tipo_obra = random.choice(TIPOS_OBRA)
            anio = random.choice(ANIOS)
            bimestre = random.choice(BIMESTRES)
            
            # Generar presupuesto base
            presupuesto = generar_consumo_base(comunidad, tipo_obra, anio, bimestre)
            
            # Avance físico esperado (0-100%)
            avance_fisico_esperado = random.randint(40, 95)
            
            # Días de retraso base (0-90 días)
            dias_retraso_base = random.randint(0, 90)
            
            # Inyectar anomalías (15% de probabilidad)
            presupuesto_final, avance_fisico, dias_retraso, es_anomalia, tipo_anomalia = \
                inyectar_anomalias(presupuesto, avance_fisico_esperado, dias_retraso_base, 
                                   probabilidad_anomalia=0.15)
            
            # Calcular avance presupuestal
            avance_presupuestal = (presupuesto_final / presupuesto * 100) if presupuesto > 0 else 0
            
            registro = {
                'comunidad': comunidad,
                'tipo_obra': tipo_obra,
                'anio': anio,
                'bimestre': bimestre,
                'presupuesto_miles_pesos': round(presupuesto, 2),
                'presupuesto_ejercido': round(presupuesto_final, 2),
                'avance_fisico_porcentaje': avance_fisico,
                'avance_presupuestal_porcentaje': round(avance_presupuestal, 2),
                'dias_retraso': dias_retraso,
                'ids_comunidad': IDS_COMUNIDADES[comunidad],
                'es_anomalia_real': es_anomalia,
                'tipo_anomalia': tipo_anomalia
            }
            
            dataset.append(registro)
            total_registros += 1
            
            if es_anomalia:
                total_anomalias += 1
    
    print()
    print(f"Total de registros generados: {total_registros}")
    print(f"Anomalías inyectadas: {total_anomalias} ({total_anomalias/total_registros*100:.2f}%)")
    print()
    
    # Guardar dataset
    with open('datos_sinteticos/obras_temascaltepec.json', 'w', encoding='utf-8') as f:
        json.dump(dataset, f, indent=2, ensure_ascii=False)
    
    print("✓ Dataset guardado en: datos_sinteticos/obras_temascaltepec.json")
    print()
    
    # Estadísticas por comunidad
    print("Estadísticas por comunidad (Top 10 por presupuesto):")
    print("-" * 70)
    
    comunidades_stats = []
    for comunidad in COMUNIDADES_TEMASCALTEPEC:
        registros_com = [r for r in dataset if r['comunidad'] == comunidad]
        presupuestos = [r['presupuesto_ejercido'] for r in registros_com]
        anomalias = sum(1 for r in registros_com if r['es_anomalia_real'])
        ids = IDS_COMUNIDADES[comunidad]
        
        comunidades_stats.append({
            'comunidad': comunidad,
            'total_obras': len(registros_com),
            'presupuesto_total': sum(presupuestos),
            'presupuesto_promedio': np.mean(presupuestos),
            'anomalias': anomalias,
            'ids': ids
        })
    
    # Ordenar por presupuesto total
    comunidades_stats.sort(key=lambda x: x['presupuesto_total'], reverse=True)
    
    for stat in comunidades_stats[:10]:
        print(f"{stat['comunidad']:35s} | Obras: {stat['total_obras']:2d} | "
              f"Presupuesto: ${stat['presupuesto_total']:10,.0f}k | "
              f"Anomalías: {stat['anomalias']:2d} ({stat['anomalias']/stat['total_obras']*100:.1f}%) | "
              f"IDS: {stat['ids']:3d}")
    
    print("=" * 70)


if __name__ == '__main__':
    main()
