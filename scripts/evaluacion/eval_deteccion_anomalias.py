"""
Evaluación del Módulo de Detección de Anomalías en Obras Públicas
==================================================================
Este script evalúa el método de detección por umbral estadístico
(este trabajo) contra un baseline de Isolation Forest, usando un
ground-truth definido por criterio operativo (regla de 3-sigma).
"""

import json
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.metrics import (
    precision_score, recall_score, f1_score,
    roc_auc_score, precision_recall_curve, auc,
    classification_report
)
import argparse
from collections import defaultdict

RANDOM_SEED = 42
np.random.seed(RANDOM_SEED)

# Constante para evitar división por cero
EPSILON = 1e-6


def cargar_datos(ruta_json):
    """Carga el dataset sintético de obras públicas"""
    with open(ruta_json, 'r', encoding='utf-8') as f:
        datos = json.load(f)
    return datos


def definir_ground_truth_operativo(datos, umbral_sigma=3.0):
    """
    Define ground-truth operativo basado en múltiples criterios.
    
    Criterios:
    1. Sobrecosto: desviación > 3 sigma del presupuesto esperado
    2. Retraso extremo: > 120 días
    3. Inconsistencia: bajo avance físico (<30%) con alto avance presupuestal (>80%)
    
    Retorna:
    - y_true: array binario (0=normal, 1=anómalo)
    - scores_umbral: array de scores del método de umbral
    """
    y_true = np.zeros(len(datos), dtype=int)
    scores_umbral = np.zeros(len(datos))
    
    # Calcular estadísticas globales de presupuesto
    presupuestos = np.array([r['presupuesto_ejercido'] for r in datos])
    media_presupuesto = np.mean(presupuestos)
    std_presupuesto = np.std(presupuestos)
    
    for i, registro in enumerate(datos):
        score_total = 0
        
        # Criterio 1: Sobrecosto (desviación del presupuesto)
        desviacion_presupuesto = abs(registro['presupuesto_ejercido'] - media_presupuesto) / (std_presupuesto + EPSILON)
        score_sobrecosto = desviacion_presupuesto
        score_total = max(score_total, score_sobrecosto)
        
        # Criterio 2: Retraso extremo
        if registro['dias_retraso'] > 120:
            score_retraso = registro['dias_retraso'] / 120.0
            score_total = max(score_total, score_retraso)
        
        # Criterio 3: Inconsistencia
        if registro['avance_fisico_porcentaje'] < 30 and registro['avance_presupuestal_porcentaje'] > 80:
            score_inconsistencia = 3.5  # Score alto por inconsistencia grave
            score_total = max(score_total, score_inconsistencia)
        
        scores_umbral[i] = score_total
        
        # Ground-truth: 1 si cumple algún criterio
        if (desviacion_presupuesto > umbral_sigma or
            registro['dias_retraso'] > 120 or
            (registro['avance_fisico_porcentaje'] < 30 and registro['avance_presupuestal_porcentaje'] > 80)):
            y_true[i] = 1
    
    return y_true, scores_umbral


def metodo_umbral_estadistico(scores_umbral, umbral_sigma=3.0):
    """
    Método propuesto: detección por umbral estadístico simple.
    
    Predicción: anomalía si score > umbral_sigma
    
    Retorna:
    - y_pred: array binario de predicciones
    """
    y_pred = (scores_umbral > umbral_sigma).astype(int)
    return y_pred


def metodo_isolation_forest(datos, contamination=0.15):
    """
    Baseline: Isolation Forest (algoritmo no supervisado).
    
    Características usadas para detección:
    - presupuesto_ejercido (normalizado)
    - avance_fisico_porcentaje (normalizado)
    - avance_presupuestal_porcentaje (normalizado)
    - dias_retraso (normalizado)
    - ids_comunidad (normalizado)
    
    Nota: contamination estimada en 15% basado en el dataset.
    
    Retorna:
    - y_pred: array binario de predicciones
    - scores_iso: array de scores (mayor = más anómalo)
    """
    # Preparar features
    features = np.array([
        [r['presupuesto_ejercido'],
         r['avance_fisico_porcentaje'],
         r['avance_presupuestal_porcentaje'],
         r['dias_retraso'],
         r['ids_comunidad']]
        for r in datos
    ])
    
    # Normalizar features
    features_norm = (features - np.mean(features, axis=0)) / (np.std(features, axis=0) + EPSILON)
    
    # Entrenar Isolation Forest
    iso_forest = IsolationForest(
        contamination=contamination,
        random_state=RANDOM_SEED,
        n_estimators=100,
        max_samples='auto'
    )
    
    # fit_predict: 1 = normal, -1 = anómalo
    predicciones = iso_forest.fit_predict(features_norm)
    
    # Convertir a formato binario (0=normal, 1=anómalo)
    y_pred = (predicciones == -1).astype(int)
    
    # Scores: más negativo = más anómalo
    scores_iso = -iso_forest.score_samples(features_norm)
    
    return y_pred, scores_iso


def calcular_metricas(y_true, y_pred, scores):
    """
    Calcula todas las métricas de evaluación.
    
    Retorna:
    - dict con precision, recall, f1, roc_auc, pr_auc
    """
    precision = precision_score(y_true, y_pred, zero_division=0)
    recall = recall_score(y_true, y_pred, zero_division=0)
    f1 = f1_score(y_true, y_pred, zero_division=0)
    
    # ROC-AUC
    try:
        roc_auc = roc_auc_score(y_true, scores)
    except ValueError:
        roc_auc = np.nan
    
    # PR-AUC
    try:
        precision_curve, recall_curve, _ = precision_recall_curve(y_true, scores)
        pr_auc = auc(recall_curve, precision_curve)
    except ValueError:
        pr_auc = np.nan
    
    return {
        'precision': precision,
        'recall': recall,
        'f1': f1,
        'roc_auc': roc_auc,
        'pr_auc': pr_auc
    }


def main():
    parser = argparse.ArgumentParser(
        description='Evaluación del módulo de detección de anomalías en obras públicas'
    )
    parser.add_argument(
        '--datos',
        type=str,
        default='datos_sinteticos/obras_temascaltepec.json',
        help='Ruta al archivo JSON con datos de obras'
    )
    parser.add_argument(
        '--umbral_sigma',
        type=float,
        default=3.0,
        help='Umbral de desviaciones estándar para ground-truth y predicción'
    )
    parser.add_argument(
        '--contaminacion_iso',
        type=float,
        default=0.15,
        help='Fracción de anomalías esperada para Isolation Forest'
    )
    args = parser.parse_args()
    
    print("=" * 70)
    print("EVALUACIÓN DEL MÓDULO DE DETECCIÓN DE ANOMALÍAS EN OBRAS PÚBLICAS")
    print("Municipio: Temascaltepec, Estado de México")
    print("=" * 70)
    print(f"Semilla aleatoria: {RANDOM_SEED}")
    print(f"Umbral sigma: {args.umbral_sigma}")
    print(f"Contaminación Isolation Forest: {args.contaminacion_iso}")
    print(f"Datos: {args.datos}")
    print()
    
    # 1. Cargar datos
    print("Cargando dataset sintético...")
    datos = cargar_datos(args.datos)
    print(f"Total de registros: {len(datos)}")
    print(f"Comunidades: {len(set(r['comunidad'] for r in datos))}")
    print(f"Períodos: {len(set((r['anio'], r['bimestre']) for r in datos))}")
    print()
    
    # 2. Definir ground-truth operativo
    print("Definiendo ground-truth operativo (múltiples criterios)...")
    print("Criterios:")
    print("  1. Sobrecosto: |presupuesto_ejercido - μ| / σ > 3.0")
    print("  2. Retraso extremo: dias_retraso > 120 días")
    print("  3. Inconsistencia: avance_fisico < 30% AND avance_presupuestal > 80%")
    print()
    y_true, scores_umbral = definir_ground_truth_operativo(datos, args.umbral_sigma)
    n_anomalias = np.sum(y_true)
    print(f"Anomalías detectadas (ground-truth): {n_anomalias} "
          f"({n_anomalias/len(y_true)*100:.2f}%)")
    print()
    
    # 3. Evaluar método de umbral estadístico (ESTE TRABAJO)
    print("=" * 70)
    print("MÉTODO 1: Regla de umbral estadístico (este trabajo)")
    print("=" * 70)
    y_pred_umbral = metodo_umbral_estadistico(scores_umbral, args.umbral_sigma)
    metricas_umbral = calcular_metricas(y_true, y_pred_umbral, scores_umbral)
    
    print(f"Precisión:  {metricas_umbral['precision']:.4f}")
    print(f"Recall:     {metricas_umbral['recall']:.4f}")
    print(f"F1:         {metricas_umbral['f1']:.4f}")
    print(f"ROC-AUC:    {metricas_umbral['roc_auc']:.4f}")
    print(f"PR-AUC:     {metricas_umbral['pr_auc']:.4f}")
    print()
    
    # 4. Evaluar Isolation Forest (REFERENCIA)
    print("=" * 70)
    print("MÉTODO 2: Isolation Forest (referencia)")
    print("=" * 70)
    y_pred_iso, scores_iso = metodo_isolation_forest(datos, args.contaminacion_iso)
    metricas_iso = calcular_metricas(y_true, y_pred_iso, scores_iso)
    
    print(f"Precisión:  {metricas_iso['precision']:.4f}")
    print(f"Recall:     {metricas_iso['recall']:.4f}")
    print(f"F1:         {metricas_iso['f1']:.4f}")
    print(f"ROC-AUC:    {metricas_iso['roc_auc']:.4f}")
    print(f"PR-AUC:     {metricas_iso['pr_auc']:.4f}")
    print()
    
    # 5. Generar tabla para el artículo
    print("=" * 70)
    print("RESULTADOS PARA CUADRO 5 (copiar al artículo):")
    print("=" * 70)
    print()
    print("Método                        Precisión  Recall   F1       ROC-AUC  PR-AUC")
    print("-" * 70)
    print(f"Regla de umbral (este trabajo)  "
          f"{metricas_umbral['precision']:.4f}   "
          f"{metricas_umbral['recall']:.4f}   "
          f"{metricas_umbral['f1']:.4f}   "
          f"{metricas_umbral['roc_auc']:.4f}   "
          f"{metricas_umbral['pr_auc']:.4f}")
    print(f"Isolation Forest (referencia)   "
          f"{metricas_iso['precision']:.4f}   "
          f"{metricas_iso['recall']:.4f}   "
          f"{metricas_iso['f1']:.4f}   "
          f"{metricas_iso['roc_auc']:.4f}   "
          f"{metricas_iso['pr_auc']:.4f}")
    print()
    
    # 6. Reporte de clasificación detallado
    print("=" * 70)
    print("REPORTE DE CLASIFICACIÓN DETALLADO")
    print("=" * 70)
    print()
    print("Método de umbral estadístico:")
    print(classification_report(y_true, y_pred_umbral, 
                                target_names=['Normal', 'Anómalo']))
    print()
    print("Isolation Forest:")
    print(classification_report(y_true, y_pred_iso, 
                                target_names=['Normal', 'Anómalo']))
    print()
    
    # 7. Guardar resultados
    resultados = {
        'semilla': RANDOM_SEED,
        'umbral_sigma': args.umbral_sigma,
        'contaminacion_iso': args.contaminacion_iso,
        'total_registros': len(datos),
        'anomalias_ground_truth': int(n_anomalias),
        'metricas_umbral_estadistico': {k: round(v, 4) for k, v in metricas_umbral.items()},
        'metricas_isolation_forest': {k: round(v, 4) for k, v in metricas_iso.items()}
    }
    
    with open('resultados_evaluacion_obras.json', 'w', encoding='utf-8') as f:
        json.dump(resultados, f, indent=2, ensure_ascii=False)
    
    print("✓ Resultados guardados en: resultados_evaluacion_obras.json")
    print("=" * 70)


if __name__ == '__main__':
    main()
