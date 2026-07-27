'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import {
  ApplicationStatus,
  CompanyPriority,
  CompanyStatus,
  HiringSignalType,
  JobStatus,
  Prisma,
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
import { jobMatchesPreferences } from './jobPreferences';
import { discoverJobLinks } from './scanning';

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
    jobsMatched: 0,
    failed: 0,
  };

  for (const company of companies) {
    const result = await scanCompanyById(userId, company.id);
    if (result.scanned) summary.scanned += 1;
    summary.jobsFound += result.jobsFound;
    summary.jobsMatched += result.jobsMatched;
    if (result.failed) summary.failed += 1;
  }

  revalidateWorkspace();
  redirect(
    `/companies?scanResult=complete&scanned=${summary.scanned}&found=${summary.jobsFound}&matched=${summary.jobsMatched}&failed=${summary.failed}`,
  );
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
  if (!company?.careersUrl) return { scanned: false, jobsFound: 0, jobsMatched: 0, failed: false };
  const careersUrl = company.careersUrl;

  try {
    const { links, strategy } = await discoverJobLinks({
      name: company.name,
      website: company.website,
      careersUrl,
    });
    const jobsFound = links.length;
    const scannedAt = new Date();
    const preferences = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        workArrangements: true,
        preferredLocations: true,
        roleFamilies: true,
        includedTitleTerms: true,
        excludedTitleTerms: true,
        seniorityLevels: true,
      },
    });
    const jobsMatched = links.filter((link) =>
      jobMatchesPreferences({ title: link.title, location: link.location ?? null, remotePolicy: null }, preferences),
    ).length;

    const existingJobs = await prisma.job.findMany({
      where: { userId, companyId },
      select: { id: true, title: true, url: true },
    });
    const existingByUrl = new Map(
      existingJobs
        .filter((job): job is typeof job & { url: string } => Boolean(job.url))
        .map((job) => [job.url.toLowerCase(), job]),
    );
    const existingByTitle = new Map(
      existingJobs.map((job) => [job.title.toLowerCase(), job]),
    );
    // A job may only be claimed by one link, otherwise two same-titled roles both resolve
    // to the same row and the transaction quietly writes one of them over the other.
    const claimed = new Set<string>();
    const operations: Prisma.PrismaPromise<unknown>[] = [
      prisma.job.updateMany({
        where: { userId, companyId, discoveredByScan: true },
        data: { isCurrent: false },
      }),
    ];

    for (const link of links) {
      const byUrl = existingByUrl.get(link.url.toLowerCase());
      const byTitle = existingByTitle.get(link.title.toLowerCase());
      const candidate = byUrl ?? byTitle;
      const existing = candidate && !claimed.has(candidate.id) ? candidate : undefined;
      if (existing) claimed.add(existing.id);

      if (existing) {
        operations.push(
          prisma.job.update({
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
          }),
        );
      } else {
        operations.push(
          prisma.job.create({
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
          }),
        );
      }
    }

    operations.push(
      prisma.company.update({
        where: { id: companyId, userId },
        data: { lastScannedAt: scannedAt },
      }),
      prisma.scanHistory.create({
        data: {
          userId,
          companyId,
          // EMPTY separates "this company has nothing open" from a scraper that broke
          // silently, which a plain SUCCESS with zero jobs could not express.
          status: jobsFound ? ScanStatus.SUCCESS : ScanStatus.EMPTY,
          jobsFound,
          jobsMatched,
          strategy,
          scannedAt,
        },
      }),
    );

    await prisma.$transaction(operations);
    return { scanned: true, jobsFound, jobsMatched, failed: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown scan failure';
    await prisma.$transaction([
      prisma.company.update({ where: { id: companyId, userId }, data: { lastScannedAt: new Date() } }),
      prisma.scanHistory.create({
        data: { userId, companyId, status: ScanStatus.FAILED, errorMessage: message },
      }),
    ]);
    return { scanned: true, jobsFound: 0, jobsMatched: 0, failed: true };
  }
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

