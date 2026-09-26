import mlwpData from 'virtual:mlwp-data';
import './styles.css';

const GRADE_VALUE = { A: 5, B: 4, C: 3, D: 2, E: 1 };
const GRADE_LABEL = {
  A: 'Great',
  B: 'Good',
  C: 'OK',
  D: 'Bad',
  E: 'Poor'
};

const BASE_URL = import.meta.env.BASE_URL;
const BASE_PATH = BASE_URL.replace(/\/$/, '');

const app = document.querySelector('#app');

function withBase(pathname = '/') {
  const [pathAndSearch, hash = ''] = pathname.split('#');
  const [path, search = ''] = pathAndSearch.split('?');
  const normalizedPath = path === '/' ? '' : path.replace(/^\/+/, '');
  return `${BASE_URL}${normalizedPath}${search ? `?${search}` : ''}${hash ? `#${hash}` : ''}`;
}

function stripBase(pathname) {
  if (BASE_PATH && pathname.startsWith(BASE_PATH)) {
    const stripped = pathname.slice(BASE_PATH.length);
    return stripped.length > 0 ? stripped : '/';
  }
  return pathname;
}

function topNav() {
  return `
    <nav class="top-nav">
      <a href="${withBase('/')}" class="nav-link">Dashboard</a>
      <a href="${withBase('/prior-work')}" class="nav-link">Prior Work</a>
      <a href="${withBase('/todo')}" class="nav-link">TODO</a>
    </nav>
  `;
}

function renderInputFormats(inputFormats) {
  if (!inputFormats) {
    return 'Not specified';
  }

  if (Array.isArray(inputFormats)) {
    const items = inputFormats
      .map((fmt) => {
        if (fmt?.name && fmt?.link) {
          return `<a href="${fmt.link}" target="_blank" rel="noreferrer">${fmt.name}</a>`;
        }
        if (typeof fmt === 'string') {
          return fmt;
        }
        return '';
      })
      .filter(Boolean);
    return items.length > 0 ? items.join(', ') : 'Not specified';
  }

  return inputFormats;
}

function gradeChip(letter) {
  return `<span class="grade-chip grade-${letter.toLowerCase()}" title="${GRADE_LABEL[letter]} performance">${letter}</span>`;
}

function metricHelpLink(metric) {
  if (metric.reference_link) {
    const heading = metric.reference_heading ?? metric.name;
    const externalAttrs = metric.reference_link.startsWith('/')
      ? ''
      : ' target="_blank" rel="noreferrer"';
    return `<a class="metric-help-link" href="${metric.reference_link}"${externalAttrs} title="About this metric: ${heading}" aria-label="About ${metric.name}">?</a>`;
  }
  return '';
}

function metricLabelHtml(metric, modelSlug) {
  if (metric.id === 'rmse' && modelSlug) {
    return `<a href="${withBase(`/models/${modelSlug}/metrics/rmse`)}">${metric.name}</a>`;
  }
  return metric.name;
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
        ${topNav()}
        <a href="${withBase('/')}" class="back-link">Verification Hub</a>
        <h1 class="title">Page not found</h1>
      </header>
      <section class="card">
        <p class="subtitle">The requested model page does not exist.</p>
      </section>
    </main>
  `;
}

function dashboardPage(data) {
  const candidateMetrics = (data.candidate_metrics ?? [])
    .map((metric) => {
      const metricName = metric.reference_link
        ? `<a href="${metric.reference_link}" target="_blank" rel="noreferrer">${metric.name}</a>`
        : metric.name;
      return `<li><strong>${metricName}:</strong> ${metric.reason ?? ''}</li>`;
    })
    .join('');

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
                  <span class="metric-name-wrap">${metricLabelHtml(metric, model.slug)}${metricHelpLink(metric)}</span>
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
            <h2><a href="${withBase(`/models/${model.slug}`)}">${model.name}</a></h2>
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
        ${topNav()}
        <a href="${withBase('/')}" class="back-link">Verification Hub</a>
        <span class="demo-badge">Demonstration</span>
        <h1 class="title">MLWP Benchmark Dashboard</h1>
        <p class="subtitle">Subject-area grades and metric-level skill scores for submitted machine learning weather prediction models, focused on km-scale forecasting systems.</p>
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
      <section class="section-head">
        <h2>Further Metrics To Consider</h2>
        <p class="subtitle">Potential verification metrics that may be useful for future assessment scope.</p>
        <ul class="candidate-metrics-list">${candidateMetrics}</ul>
      </section>
    </main>
  `;
}

function priorWorkPage(data) {
  const benchmarks = (data.prior_work?.global_benchmark_datasets ?? [])
    .map(
      (item) => `
        <article class="card">
          <h3>${item.name}</h3>
          <p class="subtitle">${item.description}</p>
          <p class="summary"><a href="${item.link}" target="_blank" rel="noreferrer">Open resource</a></p>
        </article>
      `
    )
    .join('');

  const tooling = (data.prior_work?.verification_tooling ?? [])
    .map((item) => {
      const language = item.language ?? 'Not specified';
      const inputFormat = renderInputFormats(item.input_format);
      const outputFormat = item.output_format ?? 'Not specified';
      return `
        <tr>
          <td><a href="${item.link}" target="_blank" rel="noreferrer">${item.name}</a></td>
          <td>${item.description}</td>
          <td>${language}</td>
          <td>${inputFormat}</td>
          <td>${outputFormat}</td>
        </tr>
      `;
    })
    .join('');

  const globalEfforts = (data.prior_work?.global_forecast_verification_efforts ?? [])
    .map(
      (item) => `
        <article class="card">
          <h3>${item.name}</h3>
          <p class="subtitle">${item.description}</p>
          <p class="summary"><a href="${item.link}" target="_blank" rel="noreferrer">Open resource</a></p>
        </article>
      `
    )
    .join('');

  return `
    <main class="app">
      <header class="top">
        ${topNav()}
        <a href="${withBase('/')}" class="back-link">Verification Hub</a>
        <h1 class="title">Prior Work</h1>
        <p class="subtitle">Curated references you can keep extending in <code>data/prior-work.yaml</code>.</p>
      </header>
      <section class="section-head">
        <h2>Global-Resolution Benchmark Datasets</h2>
        <p class="subtitle">Reusable datasets and benchmark tracks for ML weather prediction.</p>
      </section>
      <section class="model-grid">${benchmarks}</section>
      <section class="section-head">
        <h2>Efforts on Global Forecast Verification</h2>
        <p class="subtitle">Community coordination and shared initiatives for global forecast verification.</p>
      </section>
      <section class="model-grid">${globalEfforts}</section>
      <section class="section-head">
        <h2>Verification Tooling</h2>
        <p class="subtitle">Open tools and frameworks for verification workflows and diagnostics.</p>
      </section>
      <section class="card">
        <table>
          <thead>
            <tr>
              <th>Tool</th>
              <th>Description</th>
              <th>Programming Language</th>
              <th>Input File Format</th>
              <th>Output File Format</th>
            </tr>
          </thead>
          <tbody>${tooling}</tbody>
        </table>
      </section>
    </main>
  `;
}

function todoPage() {
  return `
    <main class="app">
      <header class="top">
        ${topNav()}
        <a href="${withBase('/')}" class="back-link">Verification Hub</a>
        <h1 class="title">TODO</h1>
      </header>
      <section class="card">
        <p class="subtitle">Find software to generate "score-cards"</p>
      </section>
    </main>
  `;
}

function rmseDataForModel(slug) {
  const byModel = {
    'aurora-mlwp-v1': {
      valid_times: ['00Z', '06Z', '12Z', '18Z', '00Z+1', '06Z+1'],
      series: [
        { variable: '2m Temperature (K)', values: [1.1, 1.0, 1.0, 1.2, 1.3, 1.4] },
        { variable: '10m Wind Speed (m/s)', values: [2.2, 2.1, 2.0, 2.2, 2.3, 2.4] },
        { variable: 'MSLP (hPa)', values: [1.7, 1.6, 1.5, 1.7, 1.8, 1.9] }
      ]
    },
    'stormnet-ens-2': {
      valid_times: ['00Z', '06Z', '12Z', '18Z', '00Z+1', '06Z+1'],
      series: [
        { variable: '2m Temperature (K)', values: [1.3, 1.2, 1.2, 1.3, 1.5, 1.6] },
        { variable: '10m Wind Speed (m/s)', values: [2.1, 2.0, 2.1, 2.2, 2.2, 2.3] },
        { variable: 'MSLP (hPa)', values: [2.0, 1.9, 1.8, 1.9, 2.1, 2.2] }
      ]
    },
    'atlas-nowcast-4': {
      valid_times: ['00Z', '06Z', '12Z', '18Z', '00Z+1', '06Z+1'],
      series: [
        { variable: '2m Temperature (K)', values: [1.5, 1.4, 1.3, 1.5, 1.6, 1.7] },
        { variable: '10m Wind Speed (m/s)', values: [2.8, 2.6, 2.5, 2.6, 2.8, 3.0] },
        { variable: 'MSLP (hPa)', values: [2.3, 2.2, 2.1, 2.2, 2.4, 2.5] }
      ]
    }
  };

  return (
    byModel[slug] ?? {
      valid_times: ['00Z', '06Z', '12Z', '18Z', '00Z+1', '06Z+1'],
      series: [
        { variable: '2m Temperature (K)', values: [1.2, 1.1, 1.1, 1.2, 1.4, 1.5] },
        { variable: '10m Wind Speed (m/s)', values: [2.4, 2.3, 2.2, 2.4, 2.5, 2.6] },
        { variable: 'MSLP (hPa)', values: [1.9, 1.8, 1.7, 1.8, 2.0, 2.1] }
      ]
    }
  );
}

function rmsePage(model) {
  const rmseData = rmseDataForModel(model?.slug ?? 'default');

  const colors = ['#2f8e63', '#2f5e8e', '#8e5a2f'];
  const width = 860;
  const height = 360;
  const leftPad = 64;
  const rightPad = 22;
  const topPad = 20;
  const bottomPad = 70;
  const plotW = width - leftPad - rightPad;
  const plotH = height - topPad - bottomPad;

  const allValues = rmseData.series.flatMap((s) => s.values);
  const yMax = Math.max(...allValues) * 1.15;
  const xStep = plotW / (rmseData.valid_times.length - 1);

  const gridLines = Array.from({ length: 6 }, (_, i) => {
    const frac = i / 5;
    const y = topPad + frac * plotH;
    const value = (yMax * (1 - frac)).toFixed(1);
    return `
      <line x1="${leftPad}" y1="${y}" x2="${leftPad + plotW}" y2="${y}" class="rmse-grid"></line>
      <text x="${leftPad - 8}" y="${y + 4}" class="rmse-axis-label" text-anchor="end">${value}</text>
    `;
  }).join('');

  const xLabels = rmseData.valid_times
    .map((label, i) => {
      const x = leftPad + i * xStep;
      return `<text x="${x}" y="${topPad + plotH + 22}" class="rmse-axis-label" text-anchor="middle">${label}</text>`;
    })
    .join('');

  const seriesPaths = rmseData.series
    .map((series, seriesIdx) => {
      const color = colors[seriesIdx % colors.length];
      const points = series.values.map((value, i) => {
        const x = leftPad + i * xStep;
        const y = topPad + plotH - (value / yMax) * plotH;
        return { x, y };
      });
      const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
      const circles = points.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="3.2" fill="${color}"></circle>`).join('');
      const legendY = topPad + plotH + 40 + seriesIdx * 16;
      return `
        <path d="${path}" fill="none" stroke="${color}" stroke-width="2.2"></path>
        ${circles}
        <rect x="${leftPad + 8}" y="${legendY - 9}" width="12" height="12" fill="${color}"></rect>
        <text x="${leftPad + 26}" y="${legendY}" class="rmse-legend-label">${series.variable}</text>
      `;
    })
    .join('');

  return `
    <main class="app">
      <header class="top">
        ${topNav()}
        <a href="${withBase('/')}" class="back-link">Verification Hub</a>
        <h1 class="title">RMSE by Physical Variable: ${model?.name ?? 'Model'}</h1>
        <p class="subtitle">Demonstration data: RMSE values computed against observations for this model and a single evaluation period.</p>
      </header>
      <section class="card">
        <svg class="rmse-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="RMSE values for multiple physical variables relative to observations">
          <rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"></rect>
          ${gridLines}
          <line x1="${leftPad}" y1="${topPad}" x2="${leftPad}" y2="${topPad + plotH}" class="rmse-axis"></line>
          <line x1="${leftPad}" y1="${topPad + plotH}" x2="${leftPad + plotW}" y2="${topPad + plotH}" class="rmse-axis"></line>
          ${xLabels}
          ${seriesPaths}
          <text x="${leftPad - 42}" y="${topPad + 8}" class="rmse-axis-title">RMSE</text>
          <text x="${leftPad + plotW / 2}" y="${height - 8}" class="rmse-axis-title" text-anchor="middle">valid_time</text>
        </svg>
        <p class="subtitle">Reference metric definition: <a href="https://jwgfvr.github.io/forecastverification/index.html#RMSE" target="_blank" rel="noreferrer">JWGfVR RMSE</a></p>
      </section>
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
              <td><span class="metric-name-wrap">${metricLabelHtml(metric, model.slug)}${metricHelpLink(metric)}</span></td>
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
          const mirrorLink = report.local_mirror_path
            ? `<a href="${withBase(`/${report.local_mirror_path}`)}">Local mirror</a>`
            : '';
          return `
            <li>
              <span>${report.label}</span>
              <span class="source-links">
                ${mirrorLink}
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
        ${topNav()}
        <a href="${withBase('/')}" class="back-link">Verification Hub</a>
        <h1 class="title">${model.name}</h1>
        <p class="subtitle">${model.provider} | ${model.model_class} | ${model.resolution} | Run cycle: ${model.run_cycle}</p>
      </header>
      ${areaCards}
    </main>
  `;
}

function route(data) {
  const path = stripBase(window.location.pathname);
  if (path === '/' || path === '/index.html') {
    return dashboardPage(data);
  }

  if (path === '/prior-work' || path === '/prior-work/') {
    return priorWorkPage(data);
  }

  if (path === '/todo' || path === '/todo/') {
    return todoPage();
  }

  const rmseModelMatch = path.match(/^\/models\/([^/]+)\/metrics\/rmse\/?$/);
  if (rmseModelMatch) {
    const slug = rmseModelMatch[1];
    const model = data.models.find((entry) => entry.slug === slug);
    if (!model) {
      return notFoundPage();
    }
    return rmsePage(model);
  }

  if (path === '/metrics/rmse' || path === '/metrics/rmse/') {
    return rmsePage(data.models[0]);
  }

  if (path.startsWith('/models/')) {
    const slug = path.replace('/models/', '').replace(/\/$/, '');
    return modelPage(data, slug);
  }

  return notFoundPage();
}

function render() {
  const params = new URLSearchParams(window.location.search);
  const redirectPath = params.get('path');
  if (redirectPath) {
    history.replaceState({}, '', withBase(decodeURIComponent(redirectPath)));
  }

  app.innerHTML = route(mlwpData);
}

render();
