import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const key = process.argv[i]; if (!key?.startsWith('--')) continue;
  const next = process.argv[i + 1]; args.set(key.slice(2), next && !next.startsWith('--') ? process.argv[++i] : 'true');
}
const baseUrl = (process.env.QPACKAGES_BASE_URL ?? 'https://qpackages.com').replace(/\/$/, '');
const outputPath = resolve(args.get('output') ?? 'schema-audit.json');
const concurrency = Math.max(1, Math.min(16, Number(args.get('concurrency') ?? 4)));
const timeoutMs = Math.max(1000, Number(args.get('timeout') ?? 30000));
const fields = new Map(); const failures = []; let detailCount = 0;

function typeOf(value) { return value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value; }
function record(path, value, id) {
  const stat = fields.get(path) ?? { path, types: new Set(), presentIn: new Set(), examples: [] };
  stat.types.add(typeOf(value)); stat.presentIn.add(id);
  if (stat.examples.length < 3 && (value === null || ['string','number','boolean'].includes(typeof value)) && !stat.examples.some((x) => Object.is(x, value))) stat.examples.push(value);
  fields.set(path, stat);
  if (Array.isArray(value)) value.forEach((item) => record(`${path}[]`, item, id));
  else if (value && typeof value === 'object') Object.entries(value).forEach(([key, child]) => record(path ? `${path}.${key}` : key, child, id));
}
async function fetchJson(url) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json, text/plain;q=0.9, */*;q=0.8', 'User-Agent': 'qpackages-schema-audit/1.0' } });
    const text = await response.text(); if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`); return JSON.parse(text);
  } finally { clearTimeout(timer); }
}
async function mapConcurrent(items, worker) {
  let cursor = 0; await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => { while (cursor < items.length) { const index = cursor++; await worker(items[index], index); } }));
}

console.log(`Fetching package list from ${baseUrl} ...`);
const packages = await fetchJson(`${baseUrl}/`); if (!Array.isArray(packages)) throw new Error('Root response was not an array.');
const packageVersions = [];
await mapConcurrent(packages, async (packageId) => {
  try { const versions = await fetchJson(`${baseUrl}/${encodeURIComponent(packageId)}?limit=0`); if (!Array.isArray(versions)) throw new Error('Version response was not an array.'); versions.forEach((item) => { if (item && typeof item.version === 'string') packageVersions.push({ packageId, version: item.version }); }); console.log(`Versions: ${packageId} (${versions.length})`); }
  catch (error) { failures.push({ stage: 'versions', packageId, error: String(error) }); console.error(`Version failure: ${packageId}: ${error}`); }
});
console.log(`Inspecting ${packageVersions.length} detail URLs with concurrency ${concurrency} ...`);
await mapConcurrent(packageVersions, async ({ packageId, version }) => {
  const id = `${packageId}@${version}`; const url = `${baseUrl}/${encodeURIComponent(packageId)}/${encodeURIComponent(version)}`;
  try { const detail = await fetchJson(url); detailCount += 1; record('', detail, id); console.log(`Detail: ${id}`); }
  catch (error) { failures.push({ stage: 'detail', packageId, version, url, error: String(error) }); console.error(`Detail failure: ${id}: ${error}`); }
});
const fieldReport = [...fields.values()].map((entry) => ({ path: entry.path || '<root>', types: [...entry.types].sort(), presentCount: entry.presentIn.size, presencePercent: detailCount ? Number((entry.presentIn.size / detailCount * 100).toFixed(2)) : 0, requiredInObservedData: entry.presentIn.size === detailCount, examples: entry.examples })).sort((a,b) => a.path.localeCompare(b.path));
const report = { generatedAt: new Date().toISOString(), sourceBaseUrl: baseUrl, packageCount: packages.length, discoveredVersionCount: packageVersions.length, inspectedDetailCount: detailCount, failureCount: failures.length, fields: fieldReport, failures };
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`Wrote ${fieldReport.length} observed field paths to ${outputPath}`); if (failures.length) process.exitCode = 2;
