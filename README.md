# A Dimensional Data Warehouse for Geospatial Monitoring of Municipal Public Works

Reference implementation and reproducibility artefacts for the ICOKG 2026 chapter by Uriel González Casiano, Marco Tulio Maldonado Mejía and Gabriel Hurtado Avilés (corresponding author), Escuela Superior de Cómputo, Instituto Politécnico Nacional.

## Public demonstration

The permanent public artefact is the GitHub Pages site:

**https://gabrielhuav.github.io/PublicMunicipalWorks_DWH/**

It is a deliberately **static** demonstration. It deploys the same HTML/CSS/JavaScript visual interface as the original `Urigc/Obras_publicas` prototype: landing page, role cards, light/dark themes, animated presentation, the four role workspaces (director, supervisor, budget planner, records office), and the citizen-participation module. For GitHub Pages, remote authentication and data-writing actions are answered by a synthetic dataset held in the visitor's own browser tab.

It does **not** use Flask, Python, Render, Supabase, Cloudflare R2, or a live API. Thus it remains available even when no backend deployment exists. The geographic locations are illustrative, and every displayed record is synthetic.

### Open access, on purpose

The demonstration credentials are printed on the landing page, and the sign-in form also accepts any value — including an empty one. That is safe because the published artefact has nothing to protect and nothing shared to damage:

| Role | User | Password |
|---|---|---|
| Director de Obras | `demo_director` | `Icokg2026-Dir` |
| Supervisor | `demo_supervisor` | `Icokg2026-Sup` |
| Proyectista | `demo_proyectista` | `Icokg2026-Pry` |
| Secretaría | `demo_secretario` | `Icokg2026-Sec` |

- State lives in `sessionStorage`, which is scoped to one tab of one browser. Whatever a visitor creates, edits or deletes is invisible to everybody else.
- Closing the tab discards it. Reopening reseeds from the constant in [`docs/js/static_backend.js`](docs/js/static_backend.js); a **restablecer demostración** button does the same on demand.
- Nothing is transmitted. There is no request that could reach a database, so no credential can be misused, and none needs to be rotated.

The same four accounts exist in the Flask reference API under `backend/`, created by [`scripts/seed_demo_users.py`](scripts/seed_demo_users.py). There the `DEMO-` prefix on `codigo_personal` makes them read-only: `routes/decorators.py` rejects every `POST`/`PUT`/`PATCH`/`DELETE` from those accounts with HTTP 403 before the handler runs. Publishing the credentials is therefore safe in both deployments, for different reasons — no server at all in one, an enforced read-only role in the other.

## What the repository contains

| Component | Location | Status |
|---|---|---|
| Static public artefact | `docs/` | Visual interface preserved from the original prototype; the four role workspaces and the participation module run against `docs/js/static_backend.js`, an in-tab stand-in for the API |
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
