## MLWP Verification Website

This repository now includes a Vite-based website for machine-learning weather prediction (MLWP) verification reporting.

### Stack

- Frontend: Vite + vanilla JavaScript (`src/`)
- Data source: YAML (`data/models.yaml`, `data/metrics.yaml`)
- Data source: YAML (`data/models.yaml`, `data/metrics.yaml`, `data/prior-work.yaml`)
- Dev backend: Vite middleware endpoint at `/api/mlwp-data`

### Data model

Site content is defined in two YAML files:

- `data/models.yaml`
- `data/metrics.yaml`
- `data/prior-work.yaml`

It contains:

- `subject_areas`: verification groups, report links, and metric IDs
- `models`: one entry per MLWP model with aggregate and metric-level `A`-`E` scores
- `metrics` (in `data/metrics.yaml`): reusable metric definitions (`name`, `focus`)
- metric references (in `data/metrics.yaml`): optional `reference_heading` + `reference_link` for external metric documentation
- candidate metrics (in `data/metrics.yaml`): optional `candidate_metrics` list shown on the dashboard as potential additions
- prior work lists (in `data/prior-work.yaml`):
- `global_benchmark_datasets` (Global-Resolution Benchmark Datasets)
- `verification_tooling`

### Run locally (with hot reloading)

1. Install dependencies:
   - `npm install`
2. Start the dev server:
   - `npm run dev`

Hot reload behavior:

- Changes in `src/` update instantly via Vite HMR.
- Changes in `data/models.yaml`, `data/metrics.yaml`, or `data/prior-work.yaml` trigger a full-page live reload.
- The dev backend always serves fresh merged YAML from `/api/mlwp-data`.

### Pages

- `/`: model dashboard
- `/models/<slug>`: model detail page
- `/prior-work`: curated prior work references (editable via `data/prior-work.yaml`)

### Build

- `npm run build`
- `npm run preview`

### GitHub Pages

- The site deploys from `.github/workflows/deploy-pages.yml` on pushes to `main` and manual workflow runs.
- The Vite build uses the repository base path on Pages, and `public/404.html` redirects deep links back into the app.
- `reports/` is gitignored and not published, so Pages builds omit "Local mirror" links. "Original" links use the `original_url` field on each report in `data/models.yaml`.

### Existing report resources

Downloaded verification references remain in `reports/` and are linked from the YAML subject areas.
