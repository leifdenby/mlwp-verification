## MLWP Verification Website

This repository now includes a Vite-based website for machine-learning weather prediction (MLWP) verification reporting.

### Stack

- Frontend: Vite + vanilla JavaScript (`src/`)
- Data source: YAML (`data/models.yaml`, `data/metrics.yaml`)
- Dev backend: Vite middleware endpoint at `/api/mlwp-data`

### Data model

Site content is defined in two YAML files:

- `data/models.yaml`
- `data/metrics.yaml`

It contains:

- `subject_areas`: verification groups, report links, and metric IDs
- `models`: one entry per MLWP model with aggregate and metric-level `A`-`E` scores
- `metrics` (in `data/metrics.yaml`): reusable metric definitions (`name`, `focus`)

### Run locally (with hot reloading)

1. Install dependencies:
   - `npm install`
2. Start the dev server:
   - `npm run dev`

Hot reload behavior:

- Changes in `src/` update instantly via Vite HMR.
- Changes in `data/models.yaml` or `data/metrics.yaml` trigger a full-page live reload.
- The dev backend always serves fresh merged YAML from `/api/mlwp-data`.

### Build

- `npm run build`
- `npm run preview`

### Existing report resources

Downloaded verification references remain in `reports/` and are linked from the YAML subject areas.
