export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
}

export function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try { return ['http:', 'https:'].includes(new URL(value).protocol); }
  catch { return false; }
}

export function displayValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined || value === '') return 'Not specified';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length ? value.join(', ') : 'None';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function compareVersionsDescending(a: string, b: string): number {
  const tokens = (v: string): Array<string | number> => v.replace(/^v/i, '').split(/[.+-]/)
    .flatMap((part) => part.split(/(\d+)/)).filter(Boolean)
    .map((part) => /^\d+$/.test(part) ? Number(part) : part.toLowerCase());
  const left = tokens(a); const right = tokens(b);
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const l = left[i]; const r = right[i];
    if (l === r) continue;
    if (l === undefined) return 1;
    if (r === undefined) return -1;
    if (typeof l === 'number' && typeof r === 'number') return r - l;
    if (typeof l === 'number') return -1;
    if (typeof r === 'number') return 1;
    return r.localeCompare(l);
  }
  return 0;
}
