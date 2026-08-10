"""
Corrected evaluation of the delay/alert detection module.
Reproduces Table 6 of the ICOKG 2026 chapter.

Difference w.r.t. the original script: the ground truth is NO LONGER derived
from the same predicate as the detector (which made precision 1.0 by
construction). It is taken from `es_anomalia_real`, the label injected
independently by the data generator.

Usage (from the repository root):
    python scripts/evaluacion/generar_dataset_obras.py
    python scripts/evaluacion/eval_deteccion_v2.py

Expected output (seed 42, 1421 records):
    Threshold rule (this work)   0.9945 0.8411 0.9114 0.9356 0.8702
    Isolation Forest (baseline)  0.8545 0.8505 0.8525 0.9855 0.9289
"""
import json
import os
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.metrics import (precision_score, recall_score, f1_score,
                             roc_auc_score, precision_recall_curve, auc,
                             confusion_matrix)

SEED = 42
EPS = 1e-6
np.random.seed(SEED)

DATASET = os.path.join('datos_sinteticos', 'obras_temascaltepec.json')

if not os.path.exists(DATASET):
    raise SystemExit(
        f"Dataset not found: {DATASET}\n"
        "Run the generator first, from the repository root:\n"
        "    python scripts/evaluacion/generar_dataset_obras.py"
    )

datos = json.load(open(DATASET, encoding='utf-8'))
n = len(datos)

# ---- INDEPENDENT ground truth (injected by the generator) -----------------
y_true = np.array([1 if r['es_anomalia_real'] else 0 for r in datos])

# ---- Rule of this work (operational criteria of the warehouse views) ------
pres = np.array([r['presupuesto_ejercido'] for r in datos])
mu, sd = pres.mean(), pres.std()

scores = np.zeros(n)
y_rule = np.zeros(n, dtype=int)
for i, r in enumerate(datos):
    dev = abs(r['presupuesto_ejercido'] - mu) / (sd + EPS)
    s = dev
    if r['dias_retraso'] > 120:
        s = max(s, r['dias_retraso'] / 120.0)
    incons = r['avance_fisico_porcentaje'] < 30 and r['avance_presupuestal_porcentaje'] > 80
    if incons:
        s = max(s, 3.5)
    scores[i] = s
    if dev > 3.0 or r['dias_retraso'] > 120 or incons:
        y_rule[i] = 1

# ---- Baseline: Isolation Forest ------------------------------------------
X = np.array([[r['presupuesto_ejercido'], r['avance_fisico_porcentaje'],
               r['avance_presupuestal_porcentaje'], r['dias_retraso'],
               r['ids_comunidad']] for r in datos])
Xn = (X - X.mean(0)) / (X.std(0) + EPS)
iso = IsolationForest(contamination=0.15, random_state=SEED, n_estimators=100)
y_iso = (iso.fit_predict(Xn) == -1).astype(int)
s_iso = -iso.score_samples(Xn)


def report(name, y_pred, sc):
    p = precision_score(y_true, y_pred, zero_division=0)
    r = recall_score(y_true, y_pred, zero_division=0)
    f = f1_score(y_true, y_pred, zero_division=0)
    roc = roc_auc_score(y_true, sc)
    pc, rc, _ = precision_recall_curve(y_true, sc)
    pr = auc(rc, pc)
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred).ravel()
    print(f"{name:34s} {p:.4f} {r:.4f} {f:.4f} {roc:.4f} {pr:.4f}"
          f"   | TP={tp} FP={fp} FN={fn} TN={tn}")
    return p, r, f, roc, pr


print(f"records={n}  communities={len(set(x['comunidad'] for x in datos))}  "
      f"positives={y_true.sum()} ({y_true.mean()*100:.2f}%)")
print(f"{'Method':34s} {'Prec':6s} {'Rec':6s} {'F1':6s} {'ROC':6s} {'PR':6s}")
report("Threshold rule (this work)", y_rule, scores)
report("Isolation Forest (baseline)", y_iso, s_iso)

print("\nRecall of the rule per injected anomaly type:")
tipos = {}
for r, pred in zip(datos, y_rule):
    if r['es_anomalia_real']:
        t = r['tipo_anomalia']
        tipos.setdefault(t, [0, 0])
        tipos[t][1] += 1
        tipos[t][0] += int(pred)
for t, (hit, tot) in sorted(tipos.items()):
    print(f"  {t:16s} {hit}/{tot} = {hit/tot:.4f}")
