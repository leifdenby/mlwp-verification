## Repository Artifacts

This workspace includes downloaded resources from `resources.md` and helper files used to fetch them.

### Download outputs

- `reports/`: one directory per report/topic from `resources.md`.
- Each report directory contains:
- `source_url.txt`: original URL from `resources.md`.
- `download.bin`: downloaded payload (HTML/PDF/binary depending on source).
- `wget.log`: download log for the main fetch attempt.
- One directory has an extra retry log:
- `reports/ivmw_2020_major_outcomes_bams_2022/wget_retry.log`.

### Intermediate files and scripts

- `work/report_links.tsv`: URL list used for downloading (topic folder name + URL).
- `work/download_reports.sh`: batch downloader script.
- `work/download_status.tsv`: per-link status (`ok`/`failed`) and downloaded size in bytes.
- `work/test_example.html`: connectivity test artifact from `wget`.
- `work/build_mlwp_site.py`: generates a static MLWP verification website from JSON input files.

### MLWP verification website

- `site/data/verification_framework.json`: verification subject areas, metric definitions, and links to report directories used as starting points.
- `site/data/models.json`: one object per submitted MLWP model, including aggregate subject grades and metric-level grades (`A`-`E`).
- Generated outputs:
- `site/index.html`: model list with color-coded aggregate subject scores and overall grade.
- `site/models/<model_slug>.html`: one page per model with subject-area aggregates and metric-by-metric breakdown tables.
- `site/styles.css`: shared styling, color scale, and responsive layout.
- Rebuild command:
- `uv run python work/build_mlwp_site.py`

### Current download status

- 9 of 10 links downloaded with non-zero content.
- The AMS XML link
- `https://journals.ametsoc.org/view/journals/bams/103/3/BAMS-D-21-0126.1.xml`
- is currently blocked for CLI download by a CloudFront WAF challenge response (`HTTP 202`, zero-length body).
