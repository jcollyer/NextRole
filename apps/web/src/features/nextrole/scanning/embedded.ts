import { cleanTitle, joinLocations, toPlainText } from './text';
import type { ScannedJobLink } from './types';

/**
 * Tier 2 of job discovery.
 *
 * Modern careers pages routinely ship the full posting list inside the HTML and then
 * reveal it with a drawer, an accordion or a client-side search box. Nothing is missing
 * from the response we already downloaded — it just is not in anchor tags. This pulls
 * the postings back out of whatever JSON the page inlined, without knowing the ATS.
 */

const titleKeys = new Set(['title', 'jobtitle', 'postingtitle', 'name', 'role', 'text']);
const urlKeys = new Set([
  'joburl',
  'applyurl',
  'apply_url',
  'absolute_url',
  'absoluteurl',
  'hostedurl',
  'careers_url',
  'externalpath',
  'permalink',
  'url',
  'link',
  'href',
]);
const locationKeys = new Set([
  'location',
  'locationtext',
  'locationstext',
  'fulllocation',
  'joblocation',
  'locationname',
  'primarylocation',
  'city',
]);
const descriptionKeys = new Set(['descriptionplain', 'description', 'content', 'jobdescription']);

/** Presence of any of these makes an object a job posting rather than a generic link. */
const jobShapeKeys = new Set([
  'joburl',
  'applyurl',
  'apply_url',
  'absolute_url',
  'absoluteurl',
  'hostedurl',
  'careers_url',
  'externalpath',
  'employmenttype',
  'workplacetype',
  'secondarylocations',
  'joblocation',
  'postingtitle',
  'requisitionid',
  'jobid',
  'departmentname',
  'department',
  'team',
]);

const assetExtensions = /\.(png|jpe?g|gif|svg|webp|avif|ico|css|js|mjs|woff2?|ttf|mp4|webm|pdf)(\?|#|$)/i;
const jobPathPattern = /\/(jobs?|careers?|openings?|positions?|vacanc\w*|apply|postings?|opportunit\w*)\//i;
const atsHostPattern =
  /(greenhouse\.io|ashbyhq\.com|lever\.co|smartrecruiters\.com|rippling\.com|myworkdayjobs\.com|workable\.com|recruitee\.com|teamtailor\.com|breezy\.hr|jazzhr\.com|bamboohr\.com|jobvite\.com|icims\.com|personio\.)/i;

/** Bounds the brace scanner so a pathological page cannot stall a scan. */
const maxScanLength = 8_000_000;
const maxObjectLength = 20_000;
const maxSteps = 20_000_000;
const maxPostings = 2000;

type Harvester = { steps: number };

function matchObjectEnd(text: string, start: number, budget: Harvester) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  const limit = Math.min(text.length, start + maxObjectLength);

  for (let index = start; index < limit; index += 1) {
    budget.steps += 1;
    if (budget.steps > maxSteps) return -1;

    const char = text[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  return -1;
}

function readString(record: Record<string, unknown>, keys: Set<string>) {
  for (const [key, value] of Object.entries(record)) {
    if (!keys.has(key.toLowerCase())) continue;
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = value as Record<string, unknown>;
      for (const nestedKey of ['name', 'label', 'fullLocation', 'text']) {
        const nestedValue = nested[nestedKey];
        if (typeof nestedValue === 'string' && nestedValue.trim()) return nestedValue.trim();
      }
    }
  }
  return null;
}

function hasJobShape(record: Record<string, unknown>) {
  return Object.keys(record).some((key) => jobShapeKeys.has(key.toLowerCase()));
}

function resolveUrl(value: string, baseUrl: string) {
  try {
    const url = new URL(value, baseUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function looksLikeJobUrl(url: string) {
  if (assetExtensions.test(url)) return false;
  return jobPathPattern.test(url) || atsHostPattern.test(url);
}

function harvestFromText(text: string, baseUrl: string, budget: Harvester) {
  const links: ScannedJobLink[] = [];
  const scanLength = Math.min(text.length, maxScanLength);

  for (let index = 0; index < scanLength; index += 1) {
    if (budget.steps > maxSteps || links.length >= maxPostings) break;
    if (text[index] !== '{') continue;

    const end = matchObjectEnd(text, index, budget);
    if (end === -1) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(text.slice(index, end + 1));
    } catch {
      continue;
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
    const record = parsed as Record<string, unknown>;

    const rawTitle = readString(record, titleKeys);
    const rawUrl = readString(record, urlKeys);
    if (!rawTitle || !rawUrl) continue;

    const url = resolveUrl(rawUrl, baseUrl);
    if (!url) continue;
    if (!looksLikeJobUrl(url) && !hasJobShape(record)) continue;

    const title = cleanTitle(rawTitle);
    if (!title || title.length > 200) continue;

    links.push({
      title,
      url,
      location: joinLocations([readString(record, locationKeys)]),
      description: toPlainText(readString(record, descriptionKeys)),
      source: 'Careers page (embedded data)',
    });

    // Children of a matched posting are never separate postings.
    index = end;
  }

  return links;
}

/** Next.js streams its RSC payload as JS string literals; unescape them back to JSON text. */
function nextFlightChunks(html: string) {
  const chunks: string[] = [];

  for (const match of html.matchAll(/self\.__next_f\.push\(\s*\[\s*\d+\s*,\s*("(?:[^"\\]|\\.)*")/g)) {
    const literal = match[1];
    if (!literal) continue;
    try {
      chunks.push(JSON.parse(literal) as string);
    } catch {
      continue;
    }
  }

  return chunks;
}

function scriptContents(html: string) {
  const contents: string[] = [];

  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    const body = match[1];
    if (body && body.includes('{')) contents.push(body);
  }

  return contents;
}

function jsonLdJobPostings(html: string, baseUrl: string) {
  const links: ScannedJobLink[] = [];

  for (const match of html.matchAll(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(match[1] ?? '');
    } catch {
      continue;
    }

    const queue: unknown[] = [parsed];
    while (queue.length) {
      const node = queue.shift();
      if (Array.isArray(node)) {
        queue.push(...node);
        continue;
      }
      if (!node || typeof node !== 'object') continue;

      const record = node as Record<string, unknown>;
      queue.push(...Object.values(record).filter((value) => value && typeof value === 'object'));

      const type = record['@type'];
      const types = Array.isArray(type) ? type : [type];
      if (!types.some((entry) => typeof entry === 'string' && entry.toLowerCase() === 'jobposting')) continue;

      const rawTitle = readString(record, titleKeys);
      const rawUrl = readString(record, new Set([...urlKeys, 'sameas']));
      if (!rawTitle || !rawUrl) continue;

      const url = resolveUrl(rawUrl, baseUrl);
      if (!url) continue;

      links.push({
        title: cleanTitle(rawTitle),
        url,
        location: joinLocations([readString(record, locationKeys)]),
        description: toPlainText(readString(record, descriptionKeys)),
        source: 'Careers page (structured data)',
      });
    }
  }

  return links;
}

export function extractEmbeddedJobs(html: string, baseUrl: string) {
  const budget: Harvester = { steps: 0 };
  const links = jsonLdJobPostings(html, baseUrl);

  const sources = [nextFlightChunks(html).join(''), ...scriptContents(html)];
  for (const source of sources) {
    if (!source) continue;
    links.push(...harvestFromText(source, baseUrl, budget));
    if (budget.steps > maxSteps || links.length >= maxPostings) break;
  }

  return links;
}
