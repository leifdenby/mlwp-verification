#!/usr/bin/env python3
"""Build a static MLWP verification website from JSON inputs."""

from __future__ import annotations

import json
from pathlib import Path
from statistics import mean

ROOT = Path(__file__).resolve().parent.parent
SITE_DIR = ROOT / "site"
DATA_DIR = SITE_DIR / "data"
MODELS_DIR = SITE_DIR / "models"

FRAMEWORK_PATH = DATA_DIR / "verification_framework.json"
MODELS_PATH = DATA_DIR / "models.json"

GRADE_TO_VALUE = {"A": 5, "B": 4, "C": 3, "D": 2, "E": 1}
VALUE_TO_GRADE = {5: "A", 4: "B", 3: "C", 2: "D", 1: "E"}
GRADE_LABEL = {
    "A": "Great",
    "B": "Good",
    "C": "OK",
    "D": "Bad",
    "E": "Terrible",
}


def load_json(path: Path) -> dict | list:
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def letter_from_values(values: list[str]) -> str:
    score = round(mean(GRADE_TO_VALUE[v] for v in values))
    score = max(1, min(5, score))
    return VALUE_TO_GRADE[score]


def grade_chip_html(letter: str) -> str:
    return (
        f'<span class="grade-chip grade-{letter.lower()}" '
        f'title="{GRADE_LABEL[letter]} performance">{letter}</span>'
    )


def page_shell(title: str, subtitle: str, body: str, nav_link: str = "../index.html") -> str:
    return f"""<!doctype html>
<html lang=\"en\">
<head>
  <meta charset=\"utf-8\">
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">
  <title>{title}</title>
  <link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">
  <link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>
  <link href=\"https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap\" rel=\"stylesheet\">
  <link rel=\"stylesheet\" href=\"{ 'styles.css' if nav_link == '#' else '../styles.css' }\">
</head>
<body>
  <div class=\"bg-orb bg-orb-1\"></div>
  <div class=\"bg-orb bg-orb-2\"></div>
  <header class=\"site-header\">
    <a class=\"back-link\" href=\"{nav_link}\">Verification Hub</a>
    <h1>{title}</h1>
    <p>{subtitle}</p>
  </header>
  <main>{body}</main>
</body>
</html>
"""


def build_index(framework: dict, models: list[dict]) -> None:
    cards = []
    for model in models:
        subject_letters = []
        subject_cells = []
        for area in framework["subject_areas"]:
            aggregate = model["scores"][area["id"]]["aggregate"]
            subject_letters.append(aggregate)
            subject_cells.append(
                f"""<div class=\"subject-mini\"><span>{area['name']}</span>{grade_chip_html(aggregate)}</div>"""
            )

        overall = letter_from_values(subject_letters)
        cards.append(
            f"""
            <article class=\"model-card\">
              <div class=\"card-top\">
                <h2><a href=\"models/{model['slug']}.html\">{model['name']}</a></h2>
                <div class=\"overall-wrap\">Overall {grade_chip_html(overall)}</div>
              </div>
              <p class=\"meta\">Provider: {model['provider']} | Class: {model['model_class']} | Resolution: {model['resolution']}</p>
              <p>{model['summary']}</p>
              <section class=\"subject-mini-grid\">{''.join(subject_cells)}</section>
            </article>
            """
        )

    body = f"""
    <section class=\"legend\">
      <h2>Grade legend</h2>
      <p>
        {grade_chip_html('A')} Great
        {grade_chip_html('B')} Good
        {grade_chip_html('C')} OK
        {grade_chip_html('D')} Bad
        {grade_chip_html('E')} Terrible
      </p>
    </section>
    <section class=\"model-grid\">
      {''.join(cards)}
    </section>
    """

    html = page_shell(
        title="MLWP Verification Dashboard",
        subtitle="Subject-area grades and metric-level skill scores for submitted machine learning weather prediction models.",
        body=body,
        nav_link="#",
    )
    (SITE_DIR / "index.html").write_text(html, encoding="utf-8")


def build_model_pages(framework: dict, models: list[dict]) -> None:
    for model in models:
        area_blocks = []
        for area in framework["subject_areas"]:
            model_area = model["scores"][area["id"]]
            rows = []
            for metric in area["metrics"]:
                score = model_area["metrics"][metric["id"]]["score"]
                note = model_area["metrics"][metric["id"]]["note"]
                rows.append(
                    f"""
                    <tr>
                      <td>{metric['name']}</td>
                      <td>{metric['focus']}</td>
                      <td>{grade_chip_html(score)}</td>
                      <td>{note}</td>
                    </tr>
                    """
                )

            sources = "".join(
                [
                    f"<li><a href=\"../{report['relative_path']}\">{report['label']}</a></li>"
                    for report in area["reports"]
                ]
            )

            area_blocks.append(
                f"""
                <section class=\"area-card\">
                  <div class=\"area-head\">
                    <h2>{area['name']}</h2>
                    <div class=\"overall-wrap\">Aggregate {grade_chip_html(model_area['aggregate'])}</div>
                  </div>
                  <p>{area['description']}</p>
                  <table>
                    <thead>
                      <tr>
                        <th>Metric</th>
                        <th>What it checks</th>
                        <th>Score</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {''.join(rows)}
                    </tbody>
                  </table>
                  <h3>Starting-point reports</h3>
                  <ul class=\"source-list\">{sources}</ul>
                </section>
                """
            )

        html = page_shell(
            title=model["name"],
            subtitle=(
                f"{model['provider']} | {model['model_class']} | {model['resolution']} | "
                f"Run cycle: {model['run_cycle']}"
            ),
            body="".join(area_blocks),
            nav_link="../index.html",
        )
        (MODELS_DIR / f"{model['slug']}.html").write_text(html, encoding="utf-8")


def write_styles() -> None:
    css = """
:root {
  --bg: #f4f7f4;
  --card: #ffffff;
  --ink: #0e1b16;
  --muted: #3b4f46;
  --line: #d6e0d9;
  --accent: #0d5c4c;
  --a: #138f43;
  --b: #4da157;
  --c: #d7a83b;
  --d: #d97b2f;
  --e: #b73f31;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: "IBM Plex Sans", sans-serif;
  color: var(--ink);
  background: radial-gradient(circle at 10% 20%, #d9eee5 0%, transparent 40%),
    radial-gradient(circle at 90% 15%, #f0e7c8 0%, transparent 38%),
    var(--bg);
  min-height: 100vh;
}

.bg-orb {
  position: fixed;
  border-radius: 50%;
  filter: blur(40px);
  opacity: 0.34;
  z-index: -1;
}

.bg-orb-1 {
  width: 320px;
  height: 320px;
  top: -90px;
  right: -80px;
  background: #8fc9b2;
}

.bg-orb-2 {
  width: 260px;
  height: 260px;
  bottom: -80px;
  left: -80px;
  background: #e5d59a;
}

.site-header {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1rem 1rem;
}

.back-link {
  font-family: "Space Mono", monospace;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: 0.8rem;
  color: var(--accent);
  text-decoration: none;
}

h1 {
  margin: 0.5rem 0;
  font-size: clamp(1.6rem, 2.2vw, 2.2rem);
}

h2, h3 {
  margin: 0;
}

p {
  margin: 0.6rem 0;
  color: var(--muted);
}

main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem 2rem;
}

.legend, .model-card, .area-card {
  background: color-mix(in hsl, var(--card) 92%, #edf4ef 8%);
  border: 1px solid var(--line);
  border-radius: 18px;
  padding: 1rem;
  margin: 0 0 1rem;
}

.model-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1rem;
}

.card-top, .area-head {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
}

.model-card h2 a {
  color: var(--ink);
  text-decoration: none;
}

.model-card h2 a:hover { text-decoration: underline; }

.meta {
  font-family: "Space Mono", monospace;
  font-size: 0.82rem;
  color: #345249;
}

.subject-mini-grid {
  margin-top: 0.8rem;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.4rem;
}

.subject-mini {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 0.45rem 0.55rem;
  background: #fbfdfc;
  font-size: 0.9rem;
}

.grade-chip {
  font-family: "Space Mono", monospace;
  color: #fff;
  border-radius: 999px;
  min-width: 2rem;
  text-align: center;
  font-size: 0.85rem;
  line-height: 1;
  padding: 0.35rem 0.5rem;
  display: inline-block;
}

.grade-a { background: var(--a); }
.grade-b { background: var(--b); }
.grade-c { background: var(--c); color: #231700; }
.grade-d { background: var(--d); }
.grade-e { background: var(--e); }

.overall-wrap {
  font-size: 0.9rem;
  color: var(--ink);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  white-space: nowrap;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin: 0.8rem 0;
  background: #fff;
}

th, td {
  border: 1px solid var(--line);
  padding: 0.6rem;
  text-align: left;
  vertical-align: top;
  font-size: 0.95rem;
}

th {
  background: #f2f8f4;
  color: #183428;
}

.source-list {
  margin: 0.5rem 0 0;
  padding-left: 1.2rem;
}

.source-list a {
  color: var(--accent);
  text-decoration: none;
}

.source-list a:hover { text-decoration: underline; }

@media (max-width: 700px) {
  .card-top, .area-head {
    flex-direction: column;
    align-items: flex-start;
  }

  th, td {
    font-size: 0.88rem;
  }
}
"""
    (SITE_DIR / "styles.css").write_text(css.strip() + "\n", encoding="utf-8")


def main() -> None:
    SITE_DIR.mkdir(exist_ok=True)
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    framework = load_json(FRAMEWORK_PATH)
    models = load_json(MODELS_PATH)

    write_styles()
    build_index(framework, models)
    build_model_pages(framework, models)

    print(f"Built site for {len(models)} model(s): {SITE_DIR / 'index.html'}")


if __name__ == "__main__":
    main()
