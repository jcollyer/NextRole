'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import {
  ApplicationStatus,
  CompanyPriority,
  CompanyStatus,
  HiringSignalType,
  JobStatus,
  ScanStatus,
  prisma,
} from '@saas/db';

import { auth } from '@/server/auth';

import {
  applicationStatuses,
  companyPriorities,
  companyStatuses,
  jobStatuses,
  signalTypes,
} from './constants';

const roleKeywords = [
  'frontend',
  'front-end',
  'product engineer',
  'full stack',
  'full-stack',
  'react',
  'typescript',
  'next.js',
  'ai engineer',
  'ai product',
  'staff engineer',
  'senior engineer',
];

const categoryWeights = new Map([
  ['fintech', 18],
  ['enterprise saas', 15],
  ['productivity saas', 13],
  ['ai-native startups', 11],
  ['ai native startups', 11],
  ['healthcare ai', 9],
]);

type ScannedJobLink = {
  title: string;
  url: string;
  location?: string | null;
  description?: string | null;
  source?: string;
};

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) redirect('/');
  return session.user.id;
}

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? '').trim();
  return value.length ? value : null;
}

function requiredText(formData: FormData, key: string) {
  const value = text(formData, key);
  if (!value) throw new Error(`${key} is required.`);
  return value;
}

function dateValue(formData: FormData, key: string) {
  const value = text(formData, key);
  return value ? new Date(`${value}T12:00:00`) : null;
}

function enumValue<T extends readonly string[]>(formData: FormData, key: string, allowed: T, fallback: T[number]) {
  const value = String(formData.get(key) ?? fallback);
  return allowed.includes(value) ? value : fallback;
}

function companyPriorityValue(formData: FormData) {
  return enumValue(formData, 'priority', companyPriorities, CompanyPriority.MEDIUM) as CompanyPriority;
}

function companyStatusValue(formData: FormData) {
  return enumValue(formData, 'status', companyStatuses, CompanyStatus.TRACKING) as CompanyStatus;
}

function jobStatusValue(formData: FormData, fallback = JobStatus.SAVED) {
  return enumValue(formData, 'status', jobStatuses, fallback) as JobStatus;
}

function applicationStatusValue(formData: FormData) {
  return enumValue(formData, 'status', applicationStatuses, ApplicationStatus.APPLIED) as ApplicationStatus;
}

function signalTypeValue(formData: FormData) {
  return enumValue(formData, 'type', signalTypes, HiringSignalType.OTHER) as HiringSignalType;
}

function revalidateWorkspace() {
  revalidatePath('/dashboard');
  revalidatePath('/companies');
  revalidatePath('/jobs');
  revalidatePath('/applications');
  revalidatePath('/follow-ups');
  revalidatePath('/signals');
}

export async function createCompany(formData: FormData) {
  const userId = await requireUserId();

  const company = await prisma.company.create({
    data: {
      userId,
      name: requiredText(formData, 'name'),
      website: text(formData, 'website'),
      careersUrl: text(formData, 'careersUrl'),
      category: text(formData, 'category'),
      stage: text(formData, 'stage'),
      location: text(formData, 'location'),
      remotePolicy: text(formData, 'remotePolicy'),
      fundingStatus: text(formData, 'fundingStatus'),
      notes: text(formData, 'notes'),
      priority: companyPriorityValue(formData),
      status: companyStatusValue(formData),
    },
  });

  revalidateWorkspace();
  redirect(`/companies/${company.id}`);
}

export async function updateCompany(formData: FormData) {
  const userId = await requireUserId();
  const id = requiredText(formData, 'id');

  await prisma.company.update({
    where: { id, userId },
    data: {
      name: requiredText(formData, 'name'),
      website: text(formData, 'website'),
      careersUrl: text(formData, 'careersUrl'),
      category: text(formData, 'category'),
      stage: text(formData, 'stage'),
      location: text(formData, 'location'),
      remotePolicy: text(formData, 'remotePolicy'),
      fundingStatus: text(formData, 'fundingStatus'),
      notes: text(formData, 'notes'),
      priority: companyPriorityValue(formData),
      status: companyStatusValue(formData),
    },
  });

  revalidateWorkspace();
  revalidatePath(`/companies/${id}`);
}

export async function deleteCompany(formData: FormData) {
  const userId = await requireUserId();
  const id = requiredText(formData, 'id');

  await prisma.company.delete({ where: { id, userId } });
  revalidateWorkspace();
  redirect('/companies');
}

export async function createJob(formData: FormData) {
  const userId = await requireUserId();
  const companyId = requiredText(formData, 'companyId');

  await prisma.job.create({
    data: {
      userId,
      companyId,
      title: requiredText(formData, 'title'),
      url: text(formData, 'url'),
      location: text(formData, 'location'),
      remotePolicy: text(formData, 'remotePolicy'),
      description: text(formData, 'description'),
      source: text(formData, 'source') ?? 'Manual',
      dateFound: dateValue(formData, 'dateFound') ?? new Date(),
      status: jobStatusValue(formData),
      isNew: jobStatusValue(formData) === JobStatus.NEW,
    },
  });

  revalidateWorkspace();
  redirect('/jobs');
}

export async function deleteJob(formData: FormData) {
  const userId = await requireUserId();
  const id = requiredText(formData, 'id');

  await prisma.job.delete({ where: { id, userId } });
  revalidateWorkspace();
}

export async function analyzeJob(formData: FormData) {
  const userId = await requireUserId();
  const id = requiredText(formData, 'id');

  const job = await prisma.job.findFirst({
    where: { id, userId },
    include: { company: true },
  });
  if (!job) return;

  const analyzed = scoreRole({
    title: job.title,
    description: job.description,
    location: job.location,
    remotePolicy: job.remotePolicy,
    companyCategory: job.company.category,
  });

  await prisma.job.update({
    where: { id, userId },
    data: {
      matchScore: analyzed.score,
      aiSummary: analyzed.summary,
      aiFitReason: analyzed.reason,
      extractedKeywords: analyzed.keywords,
      outreachAngle: analyzed.outreachAngle,
      status: JobStatus.ANALYZED,
      isNew: false,
    },
  });

  revalidateWorkspace();
}

export async function createApplication(formData: FormData) {
  const userId = await requireUserId();
  const companyId = requiredText(formData, 'companyId');
  const jobId = text(formData, 'jobId');

  await prisma.application.create({
    data: {
      userId,
      companyId,
      jobId,
      status: applicationStatusValue(formData),
      appliedAt: dateValue(formData, 'appliedAt'),
      lastFollowUpAt: dateValue(formData, 'lastFollowUpAt'),
      nextFollowUpAt: dateValue(formData, 'nextFollowUpAt'),
      recruiterContact: text(formData, 'recruiterContact'),
      referralContact: text(formData, 'referralContact'),
      notes: text(formData, 'notes'),
    },
  });

  revalidateWorkspace();
  redirect('/applications');
}

export async function updateApplication(formData: FormData) {
  const userId = await requireUserId();
  const id = requiredText(formData, 'id');

  await prisma.application.update({
    where: { id, userId },
    data: {
      status: applicationStatusValue(formData),
      lastFollowUpAt: dateValue(formData, 'lastFollowUpAt'),
      nextFollowUpAt: dateValue(formData, 'nextFollowUpAt'),
      recruiterContact: text(formData, 'recruiterContact'),
      referralContact: text(formData, 'referralContact'),
      notes: text(formData, 'notes'),
    },
  });

  revalidateWorkspace();
}

export async function markFollowUpComplete(formData: FormData) {
  const userId = await requireUserId();
  const id = requiredText(formData, 'id');
  const notes = text(formData, 'notes');

  await prisma.application.update({
    where: { id, userId },
    data: {
      lastFollowUpAt: new Date(),
      nextFollowUpAt: dateValue(formData, 'nextFollowUpAt'),
      notes: notes ?? undefined,
    },
  });

  revalidateWorkspace();
}

export async function createHiringSignal(formData: FormData) {
  const userId = await requireUserId();

  await prisma.hiringSignal.create({
    data: {
      userId,
      companyId: requiredText(formData, 'companyId'),
      type: signalTypeValue(formData),
      title: requiredText(formData, 'title'),
      sourceUrl: text(formData, 'sourceUrl'),
      signalDate: dateValue(formData, 'signalDate'),
      notes: text(formData, 'notes'),
    },
  });

  revalidateWorkspace();
  redirect('/signals');
}

export async function scanCompany(formData: FormData) {
  const userId = await requireUserId();
  const companyId = requiredText(formData, 'companyId');
  await scanCompanyById(userId, companyId);
  revalidateWorkspace();
  revalidatePath(`/companies/${companyId}`);
}

export async function scanAllCompanies() {
  const userId = await requireUserId();
  const companies = await prisma.company.findMany({
    where: { userId, careersUrl: { not: null }, status: { not: CompanyStatus.ARCHIVED } },
    select: { id: true },
  });

  if (!companies.length) {
    redirect('/companies?scanResult=none');
  }

  const summary = {
    scanned: 0,
    jobsFound: 0,
    failed: 0,
  };

  for (const company of companies) {
    const result = await scanCompanyById(userId, company.id);
    if (result.scanned) summary.scanned += 1;
    summary.jobsFound += result.jobsFound;
    if (result.failed) summary.failed += 1;
  }

  revalidateWorkspace();
  redirect(`/companies?scanResult=complete&scanned=${summary.scanned}&found=${summary.jobsFound}&failed=${summary.failed}`);
}

export async function importCompanies(formData: FormData) {
  const userId = await requireUserId();
  const raw = requiredText(formData, 'rows');
  const rows = JSON.parse(raw) as Array<Record<string, string>>;
  let imported = 0;

  for (const row of rows.slice(0, 300)) {
    const name = firstValue(row, ['Company', 'Company name', 'Name']);
    if (!name) continue;

    const existing = await prisma.company.findFirst({
      where: { userId, name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    });

    if (existing) {
      await prisma.company.update({
        where: { id: existing.id, userId },
        data: {
          careersUrl: firstValue(row, ['Careers Page Link', 'Careers URL', 'Careers']) ?? undefined,
          location: firstValue(row, ['Location']) ?? undefined,
          category: firstValue(row, ['Category']) ?? undefined,
          stage: firstValue(row, ['Stage']) ?? undefined,
          notes: firstValue(row, ['Notes']) ?? undefined,
          priority: normalizePriority(firstValue(row, ['Priority'])),
          status: normalizeCompanyStatus(firstValue(row, ['Status'])),
        },
      });
    } else {
      await prisma.company.create({
        data: {
          userId,
          name,
          careersUrl: firstValue(row, ['Careers Page Link', 'Careers URL', 'Careers']),
          location: firstValue(row, ['Location']),
          category: firstValue(row, ['Category']),
          stage: firstValue(row, ['Stage']),
          notes: firstValue(row, ['Notes']),
          priority: normalizePriority(firstValue(row, ['Priority'])),
          status: normalizeCompanyStatus(firstValue(row, ['Status'])),
        },
      });
    }

    imported += 1;
  }

  revalidateWorkspace();
  redirect(`/companies?imported=${imported}`);
}

async function scanCompanyById(userId: string, companyId: string) {
  const company = await prisma.company.findFirst({ where: { id: companyId, userId } });
  if (!company?.careersUrl) return { scanned: false, jobsFound: 0, failed: false };
  const careersUrl = company.careersUrl;

  try {
    const links = await discoverJobLinks({ name: company.name, website: company.website, careersUrl });
    const jobsFound = links.length;
    const scannedAt = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.job.updateMany({
        where: { userId, companyId, discoveredByScan: true },
        data: { isCurrent: false },
      });

      for (const link of links) {
        const existing = await tx.job.findFirst({
          where: {
            userId,
            companyId,
            OR: [{ url: link.url }, { title: { equals: link.title, mode: 'insensitive' } }],
          },
          select: { id: true },
        });

        if (existing) {
          await tx.job.update({
            where: { id: existing.id },
            data: {
              title: link.title,
              url: link.url,
              location: link.location,
              description: link.description,
              source: link.source ?? 'Careers page scan',
              discoveredByScan: true,
              isCurrent: true,
            },
          });
        } else {
          await tx.job.create({
            data: {
              userId,
              companyId,
              title: link.title,
              url: link.url,
              location: link.location,
              description: link.description,
              source: link.source ?? 'Careers page scan',
              status: JobStatus.NEW,
              isNew: true,
              discoveredByScan: true,
              isCurrent: true,
            },
          });
        }
      }

      await tx.company.update({
        where: { id: companyId, userId },
        data: { lastScannedAt: scannedAt },
      });
      await tx.scanHistory.create({
        data: { userId, companyId, status: ScanStatus.SUCCESS, jobsFound, scannedAt },
      });
    });
    return { scanned: true, jobsFound, failed: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown scan failure';
    await prisma.$transaction([
      prisma.company.update({ where: { id: companyId, userId }, data: { lastScannedAt: new Date() } }),
      prisma.scanHistory.create({
        data: { userId, companyId, status: ScanStatus.FAILED, errorMessage: message },
      }),
    ]);
    return { scanned: true, jobsFound: 0, failed: true };
  }
}

async function discoverJobLinks(company: { name: string; website: string | null; careersUrl: string }) {
  const response = await fetch(company.careersUrl, {
    headers: { 'user-agent': 'NextRole manual job checker; contact: local-user' },
    signal: AbortSignal.timeout(12000),
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    throw new Error(`Careers page returned ${response.status}`);
  }

  const html = await response.text();
  const links = extractJobLinks(html, company.careersUrl);
  const greenhouseLinks = await fetchGreenhouseJobLinks(company, html, links);

  return dedupeJobLinks([...links, ...greenhouseLinks]);
}

function extractJobLinks(html: string, baseUrl: string): ScannedJobLink[] {
  const anchors = html.matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi);
  const seen = new Set<string>();
  const matches: ScannedJobLink[] = [];

  for (const anchor of anchors) {
    const href = anchor[1];
    const content = anchor[2];
    if (!href || !content) continue;
    const label = stripTags(content).replace(/\s+/g, ' ').trim();
    const haystack = `${href} ${label}`.toLowerCase();
    if (!roleKeywords.some((keyword) => haystack.includes(keyword))) continue;

    try {
      const url = new URL(href, baseUrl).toString();
      if (seen.has(url)) continue;
      seen.add(url);
      matches.push({ title: label || inferTitleFromUrl(url), url });
    } catch {
      continue;
    }
  }

  return matches;
}

async function fetchGreenhouseJobLinks(
  company: { name: string; website: string | null; careersUrl: string },
  html: string,
  existingLinks: ScannedJobLink[],
) {
  const tokens = greenhouseBoardTokens(company, html, existingLinks);
  const results: ScannedJobLink[] = [];

  for (const token of tokens) {
    try {
      const response = await fetch(`https://boards-api.greenhouse.io/v1/boards/${token}/jobs?content=true`, {
        headers: { 'user-agent': 'NextRole manual job checker; contact: local-user' },
        signal: AbortSignal.timeout(8000),
        next: { revalidate: 0 },
      });

      if (!response.ok) continue;

      const data = (await response.json()) as GreenhouseJobsResponse;
      for (const job of data.jobs ?? []) {
        if (!job.title || !job.id) continue;
        const location = job.location?.name ?? null;
        const description = job.content ? stripTags(job.content).replace(/\s+/g, ' ').trim() : null;
        const haystack = `${job.title} ${location ?? ''} ${description ?? ''} ${job.departments?.map((department) => department.name).join(' ') ?? ''}`;
        if (!hasRoleKeyword(haystack)) continue;

        results.push({
          title: job.title,
          url: job.absolute_url || `https://job-boards.greenhouse.io/${token}/jobs/${job.id}`,
          location,
          description,
          source: 'Greenhouse job board',
        });
      }
    } catch {
      continue;
    }
  }

  return results;
}

type GreenhouseJobsResponse = {
  jobs?: Array<{
    id?: number;
    title?: string;
    absolute_url?: string;
    content?: string;
    location?: { name?: string };
    departments?: Array<{ name?: string }>;
  }>;
};

function greenhouseBoardTokens(
  company: { name: string; website: string | null; careersUrl: string },
  html: string,
  existingLinks: ScannedJobLink[],
) {
  const tokens = new Set<string>();
  const sources = [company.careersUrl, company.website ?? '', html, ...existingLinks.map((link) => link.url)];

  for (const source of sources) {
    for (const match of source.matchAll(/(?:job-boards|boards)\.greenhouse\.io\/([a-z0-9_-]+)/gi)) {
      const token = match[1];
      if (token) tokens.add(token.toLowerCase());
    }
    for (const match of source.matchAll(/boards-api\.greenhouse\.io\/v1\/boards\/([a-z0-9_-]+)/gi)) {
      const token = match[1];
      if (token) tokens.add(token.toLowerCase());
    }
  }

  const staticCareersText = stripTags(html).toLowerCase();
  const looksLikeDynamicJobsPage =
    staticCareersText.includes('all openings') &&
    staticCareersText.includes('department name') &&
    staticCareersText.includes('role name');

  if (looksLikeDynamicJobsPage) {
    const slug = company.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (slug) {
      tokens.add(slug);
      tokens.add(`${slug}work`);
    }
  }

  return Array.from(tokens);
}

function dedupeJobLinks(links: ScannedJobLink[]) {
  const seen = new Set<string>();
  const unique: ScannedJobLink[] = [];

  for (const link of links) {
    const key = `${link.url.toLowerCase()}::${link.title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(link);
  }

  return unique;
}

function hasRoleKeyword(value: string) {
  const haystack = value.toLowerCase();
  return roleKeywords.some((keyword) => haystack.includes(keyword));
}

function scoreRole(input: {
  title: string;
  description: string | null;
  location: string | null;
  remotePolicy: string | null;
  companyCategory: string | null;
}) {
  const haystack = `${input.title} ${input.description ?? ''} ${input.location ?? ''} ${input.remotePolicy ?? ''}`.toLowerCase();
  const keywords = roleKeywords.filter((keyword) => haystack.includes(keyword));
  const category = input.companyCategory?.toLowerCase() ?? '';

  let score = 35;
  score += keywords.length * 6;
  score += categoryWeights.get(category) ?? 4;
  if (/remote|hybrid|san francisco|bay area|sf/.test(haystack)) score += 12;
  if (/senior|staff|principal|lead/.test(haystack)) score += 10;
  if (/react|typescript|next\.js/.test(haystack)) score += 10;
  if (/ai|llm|workflow|automation|human-in-the-loop|dashboard/.test(haystack)) score += 8;
  score = Math.max(0, Math.min(100, score));

  const summary = `Likely ${score >= 75 ? 'strong' : score >= 55 ? 'moderate' : 'early'} fit for the target role profile based on title, seniority, location, category, and keyword overlap.`;
  const reason = keywords.length
    ? `Matched ${keywords.join(', ')} with preference weight for ${input.companyCategory ?? 'general SaaS'} and ${input.remotePolicy ?? input.location ?? 'unspecified location'} fit.`
    : 'Limited keyword overlap. Add a richer description or review manually before prioritizing.';
  const outreachAngle =
    score >= 70
      ? 'Lead with product engineering depth, React/TypeScript systems experience, and interest in data-heavy AI workflows.'
      : 'Ask a focused question about the frontend/product surface and where AI or workflow automation fits into the roadmap.';

  return { score, summary, reason, keywords, outreachAngle };
}

function firstValue(row: Record<string, string>, names: string[]) {
  for (const name of names) {
    const value = row[name]?.trim();
    if (value) return value;
  }
  return null;
}

function normalizePriority(value: string | null) {
  const normalized = value?.trim().toUpperCase();
  if (normalized === CompanyPriority.DREAM) return CompanyPriority.DREAM;
  if (normalized === CompanyPriority.HIGH) return CompanyPriority.HIGH;
  if (normalized === CompanyPriority.MEDIUM) return CompanyPriority.MEDIUM;
  if (normalized === CompanyPriority.LOW) {
    return CompanyPriority.LOW;
  }
  return CompanyPriority.MEDIUM;
}

function normalizeCompanyStatus(value: string | null) {
  const normalized = value?.trim().toUpperCase().replaceAll(' ', '_');
  if (companyStatuses.includes(normalized as (typeof companyStatuses)[number])) {
    return normalized as (typeof companyStatuses)[number];
  }
  return CompanyStatus.TRACKING;
}

function stripTags(value: string) {
  return value.replace(/<[^>]*>/g, ' ');
}

function inferTitleFromUrl(url: string) {
  const segment = new URL(url).pathname.split('/').filter(Boolean).at(-1) ?? 'New role';
  return segment.replaceAll('-', ' ').replaceAll('_', ' ');
}
