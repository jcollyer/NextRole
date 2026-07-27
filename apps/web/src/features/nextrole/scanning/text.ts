const namedEntities: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

export function decodeEntities(value: string) {
  return value.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (match, code: string) => {
    if (code.startsWith('#x') || code.startsWith('#X')) {
      const point = Number.parseInt(code.slice(2), 16);
      return Number.isNaN(point) ? match : String.fromCodePoint(point);
    }
    if (code.startsWith('#')) {
      const point = Number.parseInt(code.slice(1), 10);
      return Number.isNaN(point) ? match : String.fromCodePoint(point);
    }
    return namedEntities[code.toLowerCase()] ?? match;
  });
}

export function stripTags(value: string) {
  return value.replace(/<[^>]*>/g, ' ');
}

export function toPlainText(value: string | null | undefined, maxLength = 5000) {
  if (!value) return null;
  const text = decodeEntities(stripTags(value)).replace(/\s+/g, ' ').trim();
  if (!text.length) return null;
  return text.length > maxLength ? `${text.slice(0, maxLength).trimEnd()}…` : text;
}

export function cleanTitle(value: string) {
  return decodeEntities(stripTags(value)).replace(/\s+/g, ' ').trim();
}

export function joinLocations(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const parts: string[] = [];

  for (const value of values) {
    const cleaned = value?.replace(/\s+/g, ' ').trim();
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    parts.push(cleaned);
  }

  return parts.length ? parts.join(', ') : null;
}
