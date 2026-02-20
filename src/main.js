import './styles.css';

const GRADE_VALUE = { A: 5, B: 4, C: 3, D: 2, E: 1 };
const GRADE_LABEL = {
  A: 'Great',
  B: 'Good',
  C: 'OK',
  D: 'Bad',
  E: 'Poor'
};

const app = document.querySelector('#app');

function gradeChip(letter) {
  return `<span class="grade-chip grade-${letter.toLowerCase()}" title="${GRADE_LABEL[letter]} performance">${letter}</span>`;
}

function overallGrade(subjectGrades) {
  const values = subjectGrades.map((grade) => GRADE_VALUE[grade]);
  const score = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  const clamped = Math.max(1, Math.min(5, score));
  return Object.entries(GRADE_VALUE).find(([, value]) => value === clamped)[0];
}

function notFoundPage() {
  return `
    <main class="app">
      <header class="top">
        <a href="/" class="back-link">Verification Hub</a>
        <h1 class="title">Page not found</h1>
      </header>
      <section class="card">
        <p class="subtitle">The requested model page does not exist.</p>
      </section>
    </main>
  `;
}

function dashboardPage(data) {
  const modelCards = data.models
    .map((model) => {
      const subjectBlocks = data.subject_areas
        .map((area) => {
          const letter = model.scores[area.id].aggregate;
          const metricItems = area.metrics
            .map((metric) => {
              const metricScore = model.scores[area.id].metrics[metric.id];
              return `
                <li>
                  <span>${metric.name}</span>
                  ${gradeChip(metricScore.score)}
                </li>
              `;
            })
            .join('');
          return `
            <details class="subject-mini">
              <summary>
                <span>${area.name}</span>
                ${gradeChip(letter)}
              </summary>
              <ul class="subject-metrics">${metricItems}</ul>
            </details>
          `;
        })
        .join('');

      const overall = overallGrade(data.subject_areas.map((area) => model.scores[area.id].aggregate));

      return `
        <article class="card">
          <div class="card-top">
            <h2><a href="/models/${model.slug}">${model.name}</a></h2>
            <div class="overall-wrap">Overall ${gradeChip(overall)}</div>
          </div>
          <p class="meta">Provider: ${model.provider} | Class: ${model.model_class} | Resolution: ${model.resolution}</p>
          <p class="summary">${model.summary}</p>
          <section class="subject-mini-grid">${subjectBlocks}</section>
        </article>
      `;
    })
    .join('');

  return `
    <main class="app">
      <header class="top">
        <a href="/" class="back-link">Verification Hub</a>
        <h1 class="title">MLWP Verification Dashboard</h1>
        <p class="subtitle">Subject-area grades and metric-level skill scores for submitted machine learning weather prediction models.</p>
      </header>
      <section class="card">
        <h2>Grade Legend</h2>
        <p class="subtitle">
          ${gradeChip('A')} Great
          ${gradeChip('B')} Good
          ${gradeChip('C')} OK
          ${gradeChip('D')} Bad
          ${gradeChip('E')} Poor
        </p>
      </section>
      <section class="model-grid">${modelCards}</section>
    </main>
  `;
}

function modelPage(data, slug) {
  const model = data.models.find((entry) => entry.slug === slug);
  if (!model) {
    return notFoundPage();
  }

  const areaCards = data.subject_areas
    .map((area) => {
      const areaScore = model.scores[area.id];
      const rows = area.metrics
        .map((metric) => {
          const metricScore = areaScore.metrics[metric.id];
          return `
            <tr>
              <td>${metric.name}</td>
              <td>${metric.focus}</td>
              <td>${gradeChip(metricScore.score)}</td>
              <td>${metricScore.note}</td>
            </tr>
          `;
        })
        .join('');

      const sources = area.reports
        .map((report) => {
          const originalLink = report.original_url
            ? `<a href="${report.original_url}" target="_blank" rel="noreferrer">Original</a>`
            : `<span>Original unavailable</span>`;
          return `
            <li>
              <span>${report.label}</span>
              <span class="source-links">
                <a href="/${report.local_mirror_path}">Local mirror</a>
                ${originalLink}
              </span>
            </li>
          `;
        })
        .join('');

      return `
        <details class="card area-details">
          <summary class="area-head">
            <h2>${area.name}</h2>
            <div class="overall-wrap">Aggregate ${gradeChip(areaScore.aggregate)}</div>
          </summary>
          <p class="subtitle">${area.description}</p>
          <table>
            <thead>
              <tr>
                <th>Metric</th>
                <th>What it checks</th>
                <th>Score</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="sources">
            <h3>Starting-point reports</h3>
            <ul>${sources}</ul>
          </div>
        </details>
      `;
    })
    .join('');

  return `
    <main class="app">
      <header class="top">
        <a href="/" class="back-link">Verification Hub</a>
        <h1 class="title">${model.name}</h1>
        <p class="subtitle">${model.provider} | ${model.model_class} | ${model.resolution} | Run cycle: ${model.run_cycle}</p>
      </header>
      ${areaCards}
    </main>
  `;
}

function route(data) {
  const path = window.location.pathname;
  if (path === '/' || path === '/index.html') {
    return dashboardPage(data);
  }

  if (path.startsWith('/models/')) {
    const slug = path.replace('/models/', '').replace(/\/$/, '');
    return modelPage(data, slug);
  }

  return notFoundPage();
}

async function render() {
  try {
    const response = await fetch('/api/mlwp-data');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    app.innerHTML = route(data);
  } catch (error) {
    app.innerHTML = `
      <main class="app">
        <header class="top">
          <h1 class="title">MLWP Verification Dashboard</h1>
        </header>
        <div class="error">
          Failed to load site data from <code>data/models.yaml</code>.<br />
          ${error instanceof Error ? error.message : String(error)}
        </div>
      </main>
    `;
  }
}

render();
