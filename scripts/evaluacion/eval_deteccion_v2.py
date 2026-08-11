"""
eval_deteccion_v2.py
=============================================================================
Evalúa la regla de umbral C1-C3 contra una línea base no supervisada sobre
datos simulados por proceso, en varias semillas y varias prevalencias.

Qué cambió y por qué
--------------------
La versión anterior medía una sola semilla, una sola población, sin intervalos,
y comparaba la regla contra un Isolation Forest en su punto de operación por
omisión con la contaminación fijada a la tasa de inyección conocida. Con eso
no se puede sostener que una sea mejor que la otra: se comparan dos umbrales
distintos, no dos detectores. Un revisor lo señaló.

Aquí:

  * se evalúan varias semillas y se informa media con intervalo de confianza
    del 95 % sobre las semillas;
  * se barre la prevalencia, porque el rendimiento de cualquier detector
    depende de la tasa base y fijarla en un solo valor esconde eso;
  * el Isolation Forest se evalúa además **en el mismo presupuesto de
    alertas** que la regla —las k obras más anómalas, con k igual al número
    de alertas que levanta la regla—, que es la comparación que responde a la
    pregunta operativa: con la misma capacidad de revisión, ¿cuál acierta más?

La verdad de terreno es la causa latente que fija el generador (un contratista
poco productivo, un precio inflado, pagos adelantados, una obra parada, una
obra fantasma). No es ninguno de los predicados del detector.

Uso
---
    python scripts/evaluacion/eval_deteccion_v2.py
    python scripts/evaluacion/eval_deteccion_v2.py --semillas 20
"""
import argparse
import os
import sys

import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.metrics import (auc, f1_score, precision_recall_curve,
                             precision_score, recall_score, roc_auc_score)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from generar_dataset_obras import generar  # noqa: E402

EPS = 1e-6

# Umbrales de la regla, los mismos que implementa la vista del almacén
# warehouse.v_anomalias_deteccion.
Z_PRESUPUESTO = 3.0
DIAS_RETRASO = 120
AVANCE_FISICO_BAJO = 30.0
AVANCE_PRESUP_ALTO = 80.0


def regla(datos):
    """C1 desviación de coste, C2 retraso, C3 inconsistencia físico/financiero.

    Devuelve la decisión binaria y una puntuación continua para las curvas.
    """
    pres = np.array([r["presupuesto_ejercido"] for r in datos])
    mu, sd = pres.mean(), pres.std()
    y = np.zeros(len(datos), dtype=int)
    s = np.zeros(len(datos))
    for i, r in enumerate(datos):
        z = abs(r["presupuesto_ejercido"] - mu) / (sd + EPS)
        puntos = z
        c2 = r["dias_retraso"] > DIAS_RETRASO
        if c2:
            puntos = max(puntos, r["dias_retraso"] / DIAS_RETRASO)
        c3 = (r["avance_fisico_porcentaje"] < AVANCE_FISICO_BAJO
              and r["avance_presupuestal_porcentaje"] > AVANCE_PRESUP_ALTO)
        if c3:
            puntos = max(puntos, 3.5)
        s[i] = puntos
        if z > Z_PRESUPUESTO or c2 or c3:
            y[i] = 1
    return y, s


def rasgos(datos):
    X = np.array([[r["presupuesto_ejercido"], r["avance_fisico_porcentaje"],
                   r["avance_presupuestal_porcentaje"], r["dias_retraso"],
                   r["ids_comunidad"]] for r in datos])
    return (X - X.mean(0)) / (X.std(0) + EPS)


def metricas(y_true, y_pred, score):
    p = precision_score(y_true, y_pred, zero_division=0)
    r = recall_score(y_true, y_pred, zero_division=0)
    f = f1_score(y_true, y_pred, zero_division=0)
    roc = roc_auc_score(y_true, score)
    pc, rc, _ = precision_recall_curve(y_true, score)
    return dict(precision=p, recall=r, f1=f, roc=roc, pr=auc(rc, pc),
                alertas=int(y_pred.sum()))


def una_corrida(semilla, prevalencia):
    datos = generar(semilla, prevalencia)
    y_true = np.array([1 if r["es_anomalia_real"] else 0 for r in datos])
    y_regla, s_regla = regla(datos)

    X = rasgos(datos)
    iso = IsolationForest(contamination=prevalencia, random_state=semilla,
                          n_estimators=100).fit(X)
    s_iso = -iso.score_samples(X)
    y_iso = (iso.predict(X) == -1).astype(int)

    # Mismo presupuesto de alertas que la regla: las k más anómalas.
    k = int(y_regla.sum())
    y_iso_k = np.zeros_like(y_iso)
    if k:
        y_iso_k[np.argsort(-s_iso)[:k]] = 1

    salida = {
        "n": len(datos),
        "positivos": int(y_true.sum()),
        "regla": metricas(y_true, y_regla, s_regla),
        "iforest": metricas(y_true, y_iso, s_iso),
        "iforest_k": metricas(y_true, y_iso_k, s_iso),
    }
    # Recall por causa latente, sólo para la regla.
    por_causa = {}
    for r, pred in zip(datos, y_regla):
        if r["causa_latente"]:
            a = por_causa.setdefault(r["causa_latente"], [0, 0])
            a[1] += 1
            a[0] += int(pred)
    salida["por_causa"] = por_causa
    return salida


def ic95(valores):
    v = np.asarray(valores, dtype=float)
    if len(v) < 2:
        return v.mean(), 0.0
    return v.mean(), 1.96 * v.std(ddof=1) / np.sqrt(len(v))


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--semillas", type=int, default=10)
    ap.add_argument("--prevalencias", type=float, nargs="+",
                    default=[0.05, 0.10, 0.15, 0.20])
    args = ap.parse_args()
    semillas = list(range(42, 42 + args.semillas))

    print(f"semillas {semillas[0]}-{semillas[-1]} ({len(semillas)}), "
          f"prevalencias {args.prevalencias}")
    print("media con intervalo de confianza del 95 % sobre las semillas\n")

    principal = 0.15
    for prev in args.prevalencias:
        corridas = [una_corrida(s, prev) for s in semillas]
        n = ic95([c["n"] for c in corridas])[0]
        tasa = ic95([c["positivos"] / c["n"] for c in corridas])[0]
        print(f"── prevalencia latente {prev:.0%}  "
              f"({n:.0f} registros, {tasa:.1%} anómalos) "
              f"{'  <-- configuración principal' if prev == principal else ''}")
        print(f"   {'método':34} {'precisión':>16} {'recall':>16} {'F1':>16} "
              f"{'ROC-AUC':>16} {'PR-AUC':>16}")
        etiquetas = {
            "regla": "Threshold rule (this work)",
            "iforest": "Isolation Forest (default)",
            "iforest_k": "Isolation Forest (matched budget)",
        }
        for clave, etiqueta in etiquetas.items():
            fila = ""
            for m in ("precision", "recall", "f1", "roc", "pr"):
                media, e = ic95([c[clave][m] for c in corridas])
                fila += f" {media:.3f}±{e:.3f}".rjust(16)
            print(f"   {etiqueta:34}{fila}")
        if prev == principal:
            print("\n   recall de la regla por causa latente:")
            causas = sorted({c for x in corridas for c in x["por_causa"]})
            for causa in causas:
                v = [x["por_causa"][causa][0] / x["por_causa"][causa][1]
                     for x in corridas if causa in x["por_causa"]]
                media, e = ic95(v)
                print(f"     {causa:22} {media:.3f}±{e:.3f}")
        print()


if __name__ == "__main__":
    main()
