import { looksLikeJobUrl } from './embedded';
import { cleanTitle } from './text';
import type { ScannedJobLink } from './types';

/**
 * Tier 3 of job discovery: plain anchor scraping, for careers pages that are still
 * server-rendered lists of links.
 *
 * This used to gate on a hardcoded list of role keywords, which silently dropped every
 * title the list did not anticipate. The gate here is structural instead — does the href
 * look like a job detail page — so filtering stays a display concern.
 */

const navigationLabels = [
  'view all',
  'see all',
  'all jobs',
  'all openings',
  'open roles',
  'open positions',
  'browse jobs',
  'search jobs',
  'apply now',
  'apply here',
  'learn more',
  'read more',
  'join us',
  'join our team',
  'careers',
  'jobs',
  'life at',
  'back to',
  'privacy',
  'cookie',
  'terms',
];

function isNavigationLabel(label: string) {
  const normalized = label.toLowerCase().trim();
  if (normalized.length < 3 || normalized.length > 200) return true;
  // Job titles are effectively always more than one word; single-word links are nav.
  if (!/\s/.test(normalized)) return true;
  return navigationLabels.some((entry) => normalized === entry || normalized.startsWith(`${entry} `));
}

/**
 * A job detail URL ends in a posting id or a multi-word slug. Section links on a careers
 * site ("/jobs/benefits", "/jobs/university", "/jobs/search") end in a single bare word,
 * which is what separates them from "/jobs/senior-frontend-engineer" or "/jobs/48213".
 */
function hasJobDetailPath(url: string) {
  try {
    const { pathname } = new URL(url);
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length < 2) return false;

    const last = segments.at(-1) ?? '';
    if (last.length <= 2) return false;
    return /\d{4,}/.test(last) || /[-_]/.test(last);
  } catch {
    return false;
  }
}

export function extractAnchorJobLinks(html: string, baseUrl: string) {
  const anchors = html.matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi);
  const seen = new Set<string>();
  const links: ScannedJobLink[] = [];

  for (const anchor of anchors) {
    const href = anchor[1];
    const content = anchor[2];
    if (!href || !content) continue;

    const label = cleanTitle(content);
    if (!label || isNavigationLabel(label)) continue;

    let url: string;
    try {
      url = new URL(href, baseUrl).toString();
    } catch {
      continue;
    }

    if (!looksLikeJobUrl(url) || !hasJobDetailPath(url)) continue;

    const key = url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    links.push({ title: label, url, source: 'Careers page scan' });
  }

  return links;
}
