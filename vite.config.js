import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { defineConfig } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const modelsPath = path.resolve(__dirname, 'data/models.yaml');
const metricsPath = path.resolve(__dirname, 'data/metrics.yaml');

function toPosixPath(filePath) {
  return filePath.split(path.sep).join('/');
}

function enrichReport(report) {
  const reportAbsPath = path.resolve(__dirname, report.relative_path);
  const reportDir = path.dirname(reportAbsPath);
  const localMirrorAbsPath = path.join(reportDir, 'source_page.html');
  const sourceUrlAbsPath = path.join(reportDir, 'source_url.txt');

  let localMirrorPath = report.relative_path;
  if (fs.existsSync(localMirrorAbsPath)) {
    localMirrorPath = toPosixPath(path.relative(__dirname, localMirrorAbsPath));
  }

  let originalUrl = null;
  if (fs.existsSync(sourceUrlAbsPath)) {
    const value = fs.readFileSync(sourceUrlAbsPath, 'utf8').trim();
    originalUrl = value.length > 0 ? value : null;
  }

  return {
    ...report,
    local_mirror_path: localMirrorPath,
    original_url: originalUrl
  };
}

function readData() {
  const modelsContent = fs.readFileSync(modelsPath, 'utf8');
  const metricsContent = fs.readFileSync(metricsPath, 'utf8');
  const modelsData = yaml.load(modelsContent);
  const metricsData = yaml.load(metricsContent);
  const metricDict = metricsData?.metrics ?? {};

  const subjectAreas = (modelsData?.subject_areas ?? []).map((area) => {
    const metrics = (area.metric_ids ?? []).map((metricId) => {
      const metric = metricDict[metricId];
      if (!metric) {
        throw new Error(`Metric "${metricId}" referenced by "${area.id}" is missing in data/metrics.yaml`);
      }
      return { id: metricId, ...metric };
    });
    const reports = (area.reports ?? []).map((report) => enrichReport(report));
    return { ...area, metrics, reports };
  });

  return {
    ...modelsData,
    subject_areas: subjectAreas
  };
}

function mlwpDataApiPlugin() {
  return {
    name: 'mlwp-data-api',
    configureServer(server) {
      server.middlewares.use('/api/mlwp-data', (_req, res) => {
        try {
          const data = readData();
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
        } catch (error) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              error: 'Failed to parse data/models.yaml or data/metrics.yaml',
              details: error instanceof Error ? error.message : String(error)
            })
          );
        }
      });

      server.watcher.add([modelsPath, metricsPath]);
      server.watcher.on('change', (file) => {
        const resolved = path.resolve(file);
        if (resolved === modelsPath || resolved === metricsPath) {
          server.ws.send({ type: 'full-reload' });
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [mlwpDataApiPlugin()]
});
