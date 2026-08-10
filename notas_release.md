Archived state of the prototype at the commit corresponding to the camera-ready
chapter presented at **ICOKG 2026** and published by Springer in the series
*Advances in Computer Science Applications and Research (ACSAR)*.

> Uriel González Casiano, Marco Tulio Maldonado Mejía, Gabriel Hurtado Avilés.
> *A Dimensional Data Warehouse for Geospatial Monitoring of Municipal Public
> Works, with an Evolution Path Toward a Lakehouse Architecture.*
> Escuela Superior de Cómputo (ESCOM), Instituto Politécnico Nacional.

The prototype originated as a course project for **Bases de Datos** at ESCOM–IPN,
semester 2026-1.

## What this release contains

- Operational DDL and the dimensional warehouse: ten dimensions (five SCD Type 2,
  two Type 1, three Type 0), two fact tables, five analytical views, and the
  PL/pgSQL triggers that keep the warehouse synchronised.
- The seeded synthetic-data generators (Faker, seed 42).
- `scripts/evaluacion/eval_deteccion_v2.py`, which produces **Table 6**.
- The Flask REST API and the static administrative frontend.
- The chapter sources under `paper/`.

## Reproducing Table 6

```bash
pip install numpy scikit-learn
python scripts/evaluacion/generar_dataset_obras.py
python scripts/evaluacion/eval_deteccion_v2.py
```

Seed 42, 1,421 work–period records, 214 injected anomalies (15.06%):

| Method | Precision | Recall | F1 | ROC-AUC | PR-AUC |
|---|---|---|---|---|---|
| Threshold rule (this work) | 0.9945 | 0.8411 | 0.9114 | 0.9356 | 0.8702 |
| Isolation Forest (baseline) | 0.8545 | 0.8505 | 0.8525 | 0.9855 | 0.9289 |

Rule confusion matrix: TP=180, FP=1, FN=34, TN=1206.

## Corrections made for the camera-ready

This release supersedes the coursework state of the repository in four ways that
matter for anyone checking the chapter against the code:

1. **The evaluation script was replaced.** The previous script derived its ground
   truth from the same predicate the detector used, which made precision `1.0000`
   an algebraic identity rather than a result. `eval_deteccion_v2.py` takes the
   ground truth from `es_anomalia_real`, injected independently by the generator.
   The old script is kept as `eval_deteccion_anomalias_DEPRECATED.py` for
   provenance.
2. **The README was rewritten to match the chapter.** It previously claimed JWT
   and bcrypt (the code uses `itsdangerous` HMAC tokens and PBKDF2-SHA256), listed
   a fifth view that does not exist, and presented the chapter's *design targets*
   as measured p95 results.
3. **The documented demo credentials now exist.** Two contradictory credential
   tables were replaced by one set, seeded by `scripts/seed_demo_users.py` and
   read-only by construction via the `DEMO-` prefix.
4. **The dataset generator no longer crashes** on a clean clone; it was missing a
   `makedirs` for its output directory.

## Data

All data is synthetic (Faker, seed 42) and does not represent real public works of
the municipality of Temascaltepec. No result in the chapter has been validated
against real municipal records.

## Provenance

Independent copy of the coursework repositories
[Urigc/Obras_publicas](https://github.com/Urigc/Obras_publicas) and
[Urigc/mapa](https://github.com/Urigc/mapa), preserved with full commit history.

## License

MIT.
