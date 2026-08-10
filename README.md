# A Dimensional Data Warehouse for Geospatial Monitoring of Municipal Public Works

Reference implementation and reproducibility artefacts for the ICOKG 2026 chapter by Uriel González Casiano, Marco Tulio Maldonado Mejía and Gabriel Hurtado Avilés (corresponding author), Escuela Superior de Cómputo, Instituto Politécnico Nacional.

## Public demonstration

The permanent public artefact is the GitHub Pages site:

**https://gabrielhuav.github.io/PublicMunicipalWorks_DWH/**

It is a deliberately **static** demonstration. It deploys the same HTML/CSS/JavaScript visual interface as the original `Urigc/Obras_publicas` prototype, including its landing page, role cards, light/dark themes, animated presentation, and citizen-participation entry point. For GitHub Pages, remote authentication and data-writing actions are replaced by synthetic in-browser demonstration behaviour.

It does **not** use Flask, Python, Render, Supabase, Cloudflare R2, credentials, or a live API. Thus it remains available even when no backend deployment exists. The geographic locations are illustrative, and every displayed record is synthetic.

## What the repository contains

| Component | Location | Status |
|---|---|---|
| Static public artefact | `docs/` | Visual interface preserved from the original prototype; deployed without a server |
| Deployment workflow | `.github/workflows/deploy-pages.yml` | Publishes `docs/` after pushes to `TestDefinitivo` |
| Operational reference API | `backend/` | Flask/Python reference implementation; **not used by Pages** |
| Dimensional warehouse | `db/arquitectura/` | 10 dimensions, 2 fact tables, SCD Type 2 triggers and 5 views |
| Synthetic generators | `scripts/` | Seeded datasets and evaluation protocol |
| Paper package | `paper/` | Final source plus clean and revision-marked PDFs |

The Flask implementation and Cloudflare R2 integration are retained as architecture/reference code. They are not a claim that a permanent backend is online.

## Reproducing the detection evaluation

The evaluation uses a separate seeded synthetic dataset. From the repository root:

```bash
pip install numpy scikit-learn
python scripts/evaluacion/generar_dataset_obras.py
python scripts/evaluacion/eval_deteccion_v2.py
```

Expected protocol population: 1,421 work–period records and 214 independently injected anomalies (seed 42). The output supports the detection table in the paper; it is not evidence about Temascaltepec.

## Data model

The SQL source implements a warehouse-centric design: five SCD Type 2 dimensions (`obra`, `region`, `constructora`, `personal`, and `presupuesto`), two facts (`fact_eventos_auditoria` at audit-event grain and `fact_obra_mensual` at work × month grain), and five standard PostgreSQL views. Object storage is binary evidence storage, not a queryable lake. A complete lakehouse is future work.

## Paper package

`paper/` contains only the final LaTeX source and two generated PDFs:

- `main_final.pdf`: clean final version.
- `main_with_changes.pdf`: corrected version with review changes shown in colour.

The repository contains no real municipal, personal, or production data. It is an academic prototype under the MIT license; see [LICENSE.md](LICENSE.md).
