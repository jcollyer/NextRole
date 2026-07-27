import { extractAnchorJobLinks } from './anchors';
import { atsProviders, detectSlugs } from './atsProviders';
import { extractEmbeddedJobs } from './embedded';
import { fetchCareersPage } from './http';
import type { DiscoveryResult, DiscoveryTarget, ScannedJobLink } from './types';

export type { DiscoveryResult, DiscoveryTarget, ScannedJobLink } from './types';

/** Guards against a broad detection pattern fanning out into dozens of requests. */
const maxBoards = 6;

/**
 * Find the open roles for a company, in descending order of reliability:
 *
 *   1. a public ATS API, detected from the board slug already present on the page
 *   2. posting data the page inlined but renders behind a drawer, accordion or search
 *   3. plain anchors, for careers pages that are still server-rendered link lists
 *
 * The first tier that returns anything wins. Deliberately no keyword filtering — the scan
 * records what the company actually has open, and preference matching happens on read.
 */
export async function discoverJobLinks(target: DiscoveryTarget): Promise<DiscoveryResult> {
  const html = await fetchCareersPage(target.careersUrl);
  const haystacks = [target.careersUrl, target.website ?? '', html];

  const boards: Array<{ providerId: string; slug: string; fetchJobs: (slug: string) => Promise<ScannedJobLink[]> }> = [];
  for (const provider of atsProviders) {
    for (const slug of detectSlugs(provider, haystacks).slice(0, 3)) {
      boards.push({ providerId: provider.id, slug, fetchJobs: provider.fetchJobs });
    }
  }

  if (boards.length) {
    const settled = await Promise.all(
      boards.slice(0, maxBoards).map(async (board) => {
        try {
          return { board, links: await board.fetchJobs(board.slug) };
        } catch {
          return { board, links: [] as ScannedJobLink[] };
        }
      }),
    );

    const hits = settled.filter((entry) => entry.links.length);
    if (hits.length) {
      return {
        links: dedupeJobLinks(hits.flatMap((entry) => entry.links)),
        strategy: hits.map((entry) => `${entry.board.providerId}:${entry.board.slug}`).join(', '),
      };
    }
  }

  const embedded = dedupeJobLinks(extractEmbeddedJobs(html, target.careersUrl));
  if (embedded.length) {
    return { links: embedded, strategy: 'embedded-data' };
  }

  const anchors = dedupeJobLinks(extractAnchorJobLinks(html, target.careersUrl));
  return { links: anchors, strategy: anchors.length ? 'anchors' : 'none' };
}

/**
 * Deduped by URL, then by title plus location. Titles alone are not unique: the same role
 * is routinely posted in several cities, and collapsing on title dropped those.
 */
export function dedupeJobLinks(links: ScannedJobLink[]) {
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const unique: ScannedJobLink[] = [];

  for (const link of links) {
    const title = link.title.trim();
    if (!title || !link.url) continue;

    const urlKey = link.url.toLowerCase();
    if (seenUrls.has(urlKey)) continue;

    const titleKey = `${title.toLowerCase()}@@${(link.location ?? '').toLowerCase()}`;
    if (seenTitles.has(titleKey)) continue;

    seenUrls.add(urlKey);
    seenTitles.add(titleKey);
    unique.push({ ...link, title });
  }

  return unique;
}
