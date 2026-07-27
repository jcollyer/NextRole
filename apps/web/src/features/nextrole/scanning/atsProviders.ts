import { fetchJson } from './http';
import { cleanTitle, joinLocations, toPlainText } from './text';
import type { ScannedJobLink } from './types';

/**
 * Tier 1 of job discovery.
 *
 * Careers pages that hide roles behind a drawer, an accordion or a search box are
 * almost always a rendering choice on top of an ATS that publishes the same list as
 * public JSON. Detecting the board and calling that endpoint is both cheaper and more
 * complete than trying to drive the page.
 *
 * A provider is detected by finding its board slug in the careers HTML or in any URL we
 * already know for the company, so no company-name guessing is involved.
 */
export type AtsProvider = {
  id: string;
  label: string;
  patterns: RegExp[];
  fetchJobs: (slug: string) => Promise<ScannedJobLink[]>;
};

/** Path segments that look like a slug but never are. */
const reservedSlugs = new Set([
  'embed',
  'api',
  'jobs',
  'job',
  'search',
  'careers',
  'board',
  'boards',
  'v1',
  'www',
  'static',
  'assets',
]);

function isPlausibleSlug(slug: string | undefined): slug is string {
  if (!slug) return false;
  const normalized = slug.toLowerCase();
  if (reservedSlugs.has(normalized)) return false;
  return normalized.length >= 2 && normalized.length <= 60;
}

export function detectSlugs(provider: AtsProvider, haystacks: string[]) {
  const slugs = new Set<string>();

  for (const haystack of haystacks) {
    if (!haystack) continue;
    for (const pattern of provider.patterns) {
      for (const match of haystack.matchAll(pattern)) {
        const slug = provider.id === 'workday' ? workdaySlug(match) : match[1];
        if (isPlausibleSlug(slug)) slugs.add(slug);
      }
    }
  }

  return Array.from(slugs);
}

type GreenhouseResponse = {
  jobs?: Array<{
    id?: number;
    title?: string;
    absolute_url?: string;
    content?: string;
    location?: { name?: string };
    departments?: Array<{ name?: string }>;
  }>;
};

const greenhouse: AtsProvider = {
  id: 'greenhouse',
  label: 'Greenhouse job board',
  patterns: [
    /(?:job-boards|boards)\.greenhouse\.io\/(?:embed\/job_board\?for=)?([a-z0-9_-]+)/gi,
    /boards-api\.greenhouse\.io\/v1\/boards\/([a-z0-9_-]+)/gi,
  ],
  async fetchJobs(slug) {
    const data = await fetchJson<GreenhouseResponse>(
      `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`,
    );

    return (data?.jobs ?? []).flatMap((job) => {
      const title = job.title ? cleanTitle(job.title) : '';
      const url = job.absolute_url || (job.id ? `https://job-boards.greenhouse.io/${slug}/jobs/${job.id}` : '');
      if (!title || !url) return [];

      return [
        {
          title,
          url,
          location: joinLocations([job.location?.name]),
          description: toPlainText(job.content),
          source: 'Greenhouse job board',
        },
      ];
    });
  },
};

type AshbyResponse = {
  jobs?: Array<{
    id?: string;
    title?: string;
    jobUrl?: string;
    applyUrl?: string;
    location?: string;
    secondaryLocations?: Array<{ location?: string }>;
    descriptionPlain?: string;
    department?: string;
    team?: string;
    isListed?: boolean;
  }>;
};

const ashby: AtsProvider = {
  id: 'ashby',
  label: 'Ashby job board',
  patterns: [
    /jobs\.ashbyhq\.com\/([a-z0-9_.-]+)/gi,
    /api\.ashbyhq\.com\/posting-api\/job-board\/([a-z0-9_.-]+)/gi,
  ],
  async fetchJobs(slug) {
    const data = await fetchJson<AshbyResponse>(
      `https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=true`,
    );

    return (data?.jobs ?? []).flatMap((job) => {
      if (job.isListed === false) return [];
      const title = job.title ? cleanTitle(job.title) : '';
      const url = job.jobUrl || job.applyUrl || (job.id ? `https://jobs.ashbyhq.com/${slug}/${job.id}` : '');
      if (!title || !url) return [];

      return [
        {
          title,
          url,
          location: joinLocations([
            job.location,
            ...(job.secondaryLocations ?? []).map((entry) => entry.location),
          ]),
          description: toPlainText(job.descriptionPlain),
          source: 'Ashby job board',
        },
      ];
    });
  },
};

type LeverPosting = {
  id?: string;
  text?: string;
  hostedUrl?: string;
  applyUrl?: string;
  descriptionPlain?: string;
  workplaceType?: string;
  categories?: {
    location?: string;
    allLocations?: string[];
    team?: string;
    department?: string;
    commitment?: string;
  };
};

const lever: AtsProvider = {
  id: 'lever',
  label: 'Lever job board',
  patterns: [
    /jobs\.(?:eu\.)?lever\.co\/([a-z0-9_-]+)/gi,
    /api\.(?:eu\.)?lever\.co\/v0\/postings\/([a-z0-9_-]+)/gi,
  ],
  async fetchJobs(slug) {
    const data = await fetchJson<LeverPosting[]>(`https://api.lever.co/v0/postings/${slug}?mode=json`);
    if (!Array.isArray(data)) return [];

    return data.flatMap((job) => {
      const title = job.text ? cleanTitle(job.text) : '';
      const url = job.hostedUrl || job.applyUrl || '';
      if (!title || !url) return [];

      return [
        {
          title,
          url,
          location: joinLocations([
            job.categories?.location,
            ...(job.categories?.allLocations ?? []),
            job.workplaceType,
          ]),
          description: toPlainText(job.descriptionPlain),
          source: 'Lever job board',
        },
      ];
    });
  },
};

type SmartRecruitersResponse = {
  totalFound?: number;
  content?: Array<{
    id?: string;
    name?: string;
    company?: { identifier?: string };
    location?: {
      city?: string;
      region?: string;
      country?: string;
      fullLocation?: string;
      remote?: boolean;
    };
  }>;
};

const smartRecruiters: AtsProvider = {
  id: 'smartrecruiters',
  label: 'SmartRecruiters job board',
  patterns: [
    /careers\.smartrecruiters\.com\/([a-z0-9_-]+)/gi,
    /jobs\.smartrecruiters\.com\/([a-z0-9_-]+)/gi,
    /api\.smartrecruiters\.com\/v1\/companies\/([a-z0-9_-]+)/gi,
  ],
  async fetchJobs(slug) {
    const pageSize = 100;
    const maxPages = 10;
    const links: ScannedJobLink[] = [];

    for (let page = 0; page < maxPages; page += 1) {
      const data = await fetchJson<SmartRecruitersResponse>(
        `https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=${pageSize}&offset=${page * pageSize}`,
      );
      const content = data?.content ?? [];
      if (!content.length) break;

      for (const job of content) {
        const title = job.name ? cleanTitle(job.name) : '';
        if (!title || !job.id) continue;
        const identifier = job.company?.identifier ?? slug;

        links.push({
          title,
          url: `https://jobs.smartrecruiters.com/${identifier}/${job.id}`,
          location: joinLocations([
            job.location?.fullLocation ??
              [job.location?.city, job.location?.region, job.location?.country].filter(Boolean).join(', '),
            job.location?.remote ? 'Remote' : null,
          ]),
          source: 'SmartRecruiters job board',
        });
      }

      if (content.length < pageSize) break;
    }

    return links;
  },
};

type RipplingJob = {
  uuid?: string;
  name?: string;
  url?: string;
  department?: { label?: string };
  workLocation?: { label?: string };
};

const rippling: AtsProvider = {
  id: 'rippling',
  label: 'Rippling job board',
  patterns: [
    /ats\.rippling\.com\/([a-z0-9_-]+)/gi,
    /api\.rippling\.com\/platform\/api\/ats\/v1\/board\/([a-z0-9_-]+)/gi,
  ],
  async fetchJobs(slug) {
    const data = await fetchJson<RipplingJob[]>(
      `https://api.rippling.com/platform/api/ats/v1/board/${slug}/jobs`,
      undefined,
      15000,
    );
    if (!Array.isArray(data)) return [];

    return data.flatMap((job) => {
      const title = job.name ? cleanTitle(job.name) : '';
      const url = job.url || (job.uuid ? `https://ats.rippling.com/${slug}/jobs/${job.uuid}` : '');
      if (!title || !url) return [];

      return [
        {
          title,
          url,
          location: joinLocations([job.workLocation?.label]),
          source: 'Rippling job board',
        },
      ];
    });
  },
};

type WorkdayResponse = {
  total?: number;
  jobPostings?: Array<{
    title?: string;
    externalPath?: string;
    locationsText?: string;
  }>;
};

/** Workday needs three parts to address a board, so the slug is a composite. */
function workdaySlug(match: RegExpMatchArray) {
  const [, tenant, host, site] = match;
  if (!tenant || !host || !site) return undefined;
  return `${tenant}::${host}::${site}`;
}

const workday: AtsProvider = {
  id: 'workday',
  label: 'Workday job board',
  patterns: [
    /([a-z0-9-]+)\.(wd[0-9]+)\.myworkdayjobs\.com\/(?:wday\/cxs\/[a-z0-9-]+\/)?(?:[a-z]{2}-[A-Z]{2}\/)?([A-Za-z0-9_-]+)/gi,
  ],
  async fetchJobs(slug) {
    const [tenant, host, site] = slug.split('::');
    if (!tenant || !host || !site) return [];

    const origin = `https://${tenant}.${host}.myworkdayjobs.com`;
    const pageSize = 20;
    const maxPages = 15;
    const links: ScannedJobLink[] = [];
    // Workday reports the result count on the first page only; later pages return total: 0,
    // so it has to be captured once rather than re-read as a stop condition every page.
    let total = Number.POSITIVE_INFINITY;

    for (let page = 0; page < maxPages; page += 1) {
      const data = await fetchJson<WorkdayResponse>(
        `${origin}/wday/cxs/${tenant}/${site}/jobs`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ appliedFacets: {}, limit: pageSize, offset: page * pageSize, searchText: '' }),
        },
        15000,
      );

      const postings = data?.jobPostings ?? [];
      if (!postings.length) break;
      if (page === 0 && data?.total) total = data.total;

      for (const job of postings) {
        const title = job.title ? cleanTitle(job.title) : '';
        if (!title || !job.externalPath) continue;

        links.push({
          title,
          url: `${origin}/${site}${job.externalPath}`,
          location: joinLocations([job.locationsText]),
          source: 'Workday job board',
        });
      }

      if (postings.length < pageSize || page * pageSize + postings.length >= total) break;
    }

    return links;
  },
};

type WorkableResponse = {
  jobs?: Array<{
    title?: string;
    shortcode?: string;
    url?: string;
    application_url?: string;
    location?: { city?: string; region?: string; country?: string; telecommuting?: boolean };
    description?: string;
  }>;
};

/**
 * Workable and Recruitee use documented public widget endpoints, but no live board was
 * available to verify the exact payload against. They fail closed like every other
 * provider, so a wrong assumption here costs a discarded request and nothing else.
 */
const workable: AtsProvider = {
  id: 'workable',
  label: 'Workable job board',
  patterns: [/apply\.workable\.com\/([a-z0-9_-]+)/gi, /([a-z0-9_-]+)\.workable\.com/gi],
  async fetchJobs(slug) {
    const data = await fetchJson<WorkableResponse>(
      `https://apply.workable.com/api/v1/widget/accounts/${slug}?details=true`,
    );

    return (data?.jobs ?? []).flatMap((job) => {
      const title = job.title ? cleanTitle(job.title) : '';
      const url = job.url || job.application_url || (job.shortcode ? `https://apply.workable.com/${slug}/j/${job.shortcode}/` : '');
      if (!title || !url) return [];

      return [
        {
          title,
          url,
          location: joinLocations([
            [job.location?.city, job.location?.region, job.location?.country].filter(Boolean).join(', '),
            job.location?.telecommuting ? 'Remote' : null,
          ]),
          description: toPlainText(job.description),
          source: 'Workable job board',
        },
      ];
    });
  },
};

type RecruiteeResponse = {
  offers?: Array<{
    id?: number;
    title?: string;
    careers_url?: string;
    careers_apply_url?: string;
    location?: string;
    city?: string;
    country?: string;
    description?: string;
    remote?: boolean;
  }>;
};

const recruitee: AtsProvider = {
  id: 'recruitee',
  label: 'Recruitee job board',
  patterns: [/([a-z0-9_-]+)\.recruitee\.com/gi],
  async fetchJobs(slug) {
    const data = await fetchJson<RecruiteeResponse>(`https://${slug}.recruitee.com/api/offers/`);

    return (data?.offers ?? []).flatMap((job) => {
      const title = job.title ? cleanTitle(job.title) : '';
      const url = job.careers_url || job.careers_apply_url || '';
      if (!title || !url) return [];

      return [
        {
          title,
          url,
          location: joinLocations([job.location ?? [job.city, job.country].filter(Boolean).join(', '), job.remote ? 'Remote' : null]),
          description: toPlainText(job.description),
          source: 'Recruitee job board',
        },
      ];
    });
  },
};

export const atsProviders: AtsProvider[] = [
  greenhouse,
  ashby,
  lever,
  smartRecruiters,
  rippling,
  workday,
  workable,
  recruitee,
];
