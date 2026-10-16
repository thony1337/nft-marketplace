// Auditoria Lighthouse reproduzível: Início e Detalhe, perfis mobile e desktop, N medições por página/perfil
// (padrão 3), mediana por categoria e métricas (LCP, CLS, TBT). Roda contra o build de produção servido por
// servidor estático comprimido (brotli/gzip), com os mocks ligados e o cenário padrão.
//
//   npm run lighthouse                # build + preview + 3 medições por página e perfil
//   npm run lighthouse -- --runs=1    # medição rápida
//   LH_BASE_URL=https://seu-deploy.vercel.app npm run lighthouse   # audita uma URL já publicada
//
// Saída: lighthouse/reports/*.{html,json} (todas as medições) e lighthouse/results.md (medianas, versões, ambiente).
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync, statSync, createReadStream } from 'node:fs';
import http from 'node:http';
import zlib from 'node:zlib';
import { extname, normalize } from 'node:path';
import os from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const reportsDir = join(here, 'reports');
const runs = Number((process.argv.find((a) => a.startsWith('--runs=')) ?? '--runs=3').split('=')[1]);
const PORT = 4173;
const externalBase = process.env.LH_BASE_URL?.replace(/\/$/, '');
const base = externalBase ?? `http://localhost:${PORT}`;

const PAGES = [
  { id: 'inicio', label: 'Início', path: '/' },
  { id: 'detalhe', label: 'Detalhe do NFT', path: '/nft/nft-1' },
];
const PROFILES = [
  { id: 'mobile', label: 'Mobile', config: undefined },
  { id: 'desktop', label: 'Desktop', config: desktopConfig },
];
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'];
const TARGETS = { performance: 90, accessibility: 95, 'best-practices': 95, seo: 90 };
const METRICS = [
  ['LCP', 'largest-contentful-paint', (v) => `${(v / 1000).toFixed(2)} s`],
  ['CLS', 'cumulative-layout-shift', (v) => v.toFixed(3)],
  ['TBT', 'total-blocking-time', (v) => `${Math.round(v)} ms`],
];

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

async function waitFor(url, timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* ainda subindo */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`O servidor não respondeu em ${url}`);
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain' };
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.svg', '.txt']);

// Imita a Vercel: arquivos comprimidos, cache imutável em /assets e fallback de SPA
function startStaticServer(dir, port) {
  return http
    .createServer((req, res) => {
      const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let file = join(dir, normalize(urlPath));
      if (!file.startsWith(dir) || !existsSync(file) || statSync(file).isDirectory()) file = join(dir, 'index.html');
      const ext = extname(file);
      const headers = { 'Content-Type': MIME[ext] ?? 'application/octet-stream' };
      if (urlPath.startsWith('/assets/')) headers['Cache-Control'] = 'public, max-age=31536000, immutable';
      const accept = String(req.headers['accept-encoding'] ?? '');
      let stream = createReadStream(file);
      if (COMPRESSIBLE.has(ext) && /\bbr\b/.test(accept)) {
        headers['Content-Encoding'] = 'br';
        stream = stream.pipe(zlib.createBrotliCompress({ params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } }));
      } else if (COMPRESSIBLE.has(ext) && /\bgzip\b/.test(accept)) {
        headers['Content-Encoding'] = 'gzip';
        stream = stream.pipe(zlib.createGzip());
      }
      res.writeHead(200, headers);
      stream.pipe(res);
    })
    .listen(port);
}

let server;
if (!externalBase) {
  console.log('> build de produção (mocks ligados)');
  execSync('npm run build', { cwd: root, stdio: 'inherit', env: { ...process.env, VITE_ENABLE_MOCKS: 'true' } });
  console.log(`> servidor estático (brotli/gzip, fallback SPA) em ${base}`);
  server = startStaticServer(join(root, 'dist'), PORT);
  await waitFor(base);
}

rmSync(reportsDir, { recursive: true, force: true });
mkdirSync(reportsDir, { recursive: true });

const results = [];
let versions = {};
try {
  for (const page of PAGES) {
    for (const profile of PROFILES) {
      const samples = [];
      for (let run = 1; run <= runs; run++) {
        const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless=new', '--no-sandbox'] });
        try {
          const result = await lighthouse(
            `${base}${page.path}`,
            { port: chrome.port, output: ['json', 'html'], onlyCategories: CATEGORIES, logLevel: 'error' },
            profile.config,
          );
          const [json, html] = result.report;
          const name = `${page.id}-${profile.id}-${run}`;
          writeFileSync(join(reportsDir, `${name}.json`), json);
          writeFileSync(join(reportsDir, `${name}.html`), html);
          const { lhr } = result;
          if (lhr.runtimeError) throw new Error(`Lighthouse falhou em ${page.path}: ${lhr.runtimeError.code} — ${lhr.runtimeError.message}`);
          versions = { lighthouse: lhr.lighthouseVersion, chrome: lhr.environment.hostUserAgent, form: lhr.configSettings.formFactor };
          samples.push({
            scores: Object.fromEntries(CATEGORIES.map((c) => [c, Math.round((lhr.categories[c].score ?? 0) * 100)])),
            metrics: Object.fromEntries(METRICS.map(([k, id]) => [k, lhr.audits[id].numericValue])),
          });
          console.log(`  ${page.label} / ${profile.label} #${run}: ${JSON.stringify(samples.at(-1).scores)}`);
        } finally {
          await chrome.kill();
        }
      }
      results.push({
        page,
        profile,
        scores: Object.fromEntries(CATEGORIES.map((c) => [c, median(samples.map((s) => s.scores[c]))])),
        metrics: Object.fromEntries(METRICS.map(([k]) => [k, median(samples.map((s) => s.metrics[k]))])),
        raw: samples.map((s) => s.scores),
      });
    }
  }
} finally {
  server?.closeAllConnections?.();
  server?.close();
}

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const lines = [];
lines.push('# Resultados do Lighthouse', '');
lines.push(`Medições por página e perfil: **${runs}** (mediana de cada categoria e métrica).`, '');
lines.push('| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |');
lines.push('| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
for (const r of results) {
  const cell = (c) => `${r.scores[c]}${r.scores[c] < TARGETS[c] ? ' ⚠️' : ''}`;
  lines.push(
    `| ${r.page.label} | ${r.profile.label} | ${CATEGORIES.map(cell).join(' | ')} | ${METRICS.map(([k, , fmt]) => fmt(r.metrics[k])).join(' | ')} |`,
  );
}
lines.push('', `Metas: Performance ≥ ${TARGETS.performance}, Accessibility ≥ ${TARGETS.accessibility}, Best Practices ≥ ${TARGETS['best-practices']}, SEO ≥ ${TARGETS.seo}. ⚠️ = abaixo da meta.`, '');
lines.push('## Medições individuais (Performance / Accessibility / Best Practices / SEO)', '');
for (const r of results) {
  lines.push(`- ${r.page.label} / ${r.profile.label}: ${r.raw.map((s) => CATEGORIES.map((c) => s[c]).join('/')).join(' · ')}`);
}
lines.push('', '## Ambiente e condições', '');
lines.push(`- URL auditada: ${base} (${externalBase ? 'URL informada em LH_BASE_URL' : 'build de produção local servido de `dist/` com brotli/gzip'})`);
lines.push('- Mocks: ligados (`VITE_ENABLE_MOCKS=true`), cenário padrão (`default`: latência de 150 a 450 ms), imagens, fontes e tempo real ativos');
lines.push(`- Lighthouse ${versions.lighthouse} · ${versions.chrome}`);
lines.push(`- Perfis: mobile (padrão do Lighthouse: emulação de celular e throttling simulado) e desktop (\`desktop-config\`)`);
lines.push(`- Node ${process.version} · ${os.type()} ${os.release()} · ${os.cpus()[0]?.model} (${os.cpus().length} núcleos) · ${Math.round(os.totalmem() / 2 ** 30)} GB`);
lines.push(`- Projeto: ${pkg.name}@${pkg.version}`);
lines.push(`- Data: ${new Date().toISOString()}`, '');
lines.push('Relatórios completos (HTML e JSON de cada medição): `lighthouse/reports/`.', '');
const justificativasPath = join(here, 'justificativas.md');
lines.push('## Justificativas para resultados abaixo da meta', '');
lines.push(
  existsSync(justificativasPath)
    ? readFileSync(justificativasPath, 'utf8').trim()
    : '_Preencher em `lighthouse/justificativas.md` se alguma célula estiver marcada com ⚠️._',
  '',
);
writeFileSync(join(here, 'results.md'), lines.join('\n'));
console.log(`\nResultados em lighthouse/results.md`);
