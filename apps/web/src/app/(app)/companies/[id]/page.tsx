import type React from 'react';
import { notFound, redirect } from 'next/navigation';
import { ExternalLink, Radar, Trash2 } from 'lucide-react';

import { prisma } from '@saas/db';

import { Button } from '@/components/ui/button';
import { auth } from '@/server/auth';
import { CompanyForm } from '@/features/nextrole/forms';
import { deleteCompany, scanCompany } from '@/features/nextrole/actions';
import { formatDate, PageHeader, StatusBadge } from '@/features/nextrole/ui';
import { jobMatchesPreferences } from '@/features/nextrole/jobPreferences';

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/');
  const { id } = await params;

  const company = await prisma.company.findFirst({
    where: { id, userId: session.user.id },
    include: {
      jobs: {
        where: { OR: [{ discoveredByScan: false }, { isCurrent: true }] },
        orderBy: { createdAt: 'desc' },
      },
      applications: { include: { job: true }, orderBy: { updatedAt: 'desc' }, take: 8 },
      scanHistory: { orderBy: { scannedAt: 'desc' }, take: 6 },
      hiringSignals: { orderBy: [{ signalDate: 'desc' }, { createdAt: 'desc' }], take: 6 },
      user: {
        select: {
          workArrangements: true,
          preferredLocations: true,
          roleFamilies: true,
          includedTitleTerms: true,
          excludedTitleTerms: true,
          seniorityLevels: true,
        },
      },
    },
  });
  if (!company) notFound();
  const matchingJobs = company.jobs.filter((job) => jobMatchesPreferences(job, company.user));
  const otherJobs = company.jobs.filter((job) => !jobMatchesPreferences(job, company.user));

  const renderJob = (job: (typeof company.jobs)[number]) => {
    const row = (
      <>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{job.title}</span>
          <span className="text-muted-foreground block truncate text-xs">
            {job.location ?? job.source ?? 'No location'}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {job.url ? <ExternalLink className="text-muted-foreground h-4 w-4" /> : null}
        </span>
      </>
    );
    return job.url ? (
      <a
        key={job.id}
        href={job.url}
        target="_blank"
        rel="noreferrer"
        className="hover:bg-muted/50 flex items-center justify-between gap-4 border-b px-4 py-3 last:border-b-0"
      >
        {row}
      </a>
    ) : (
      <div
        key={job.id}
        className="flex items-center justify-between gap-4 border-b px-4 py-3 last:border-b-0"
      >
        {row}
      </div>
    );
  };

  return (
    <div>
      <PageHeader
        title={company.name}
        eyebrow={`${company.category ?? 'Uncategorized'} · ${company.location ?? 'Location TBD'}`}
      >
        {company.website ? (
          <Button asChild variant="outline">
            <a href={company.website} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" />
              Website
            </a>
          </Button>
        ) : null}
        <form action={scanCompany}>
          <input type="hidden" name="companyId" value={company.id} />
          <Button type="submit" variant="outline" disabled={!company.careersUrl}>
            <Radar className="h-4 w-4" />
            Scan company
          </Button>
        </form>
        <form action={deleteCompany}>
          <input type="hidden" name="id" value={company.id} />
          <Button type="submit" variant="destructive">
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </form>
      </PageHeader>

      <div className="mb-6 grid gap-3 md:grid-cols-4">
        <Info
          label="Priority"
          value={
            <StatusBadge
              value={company.priority}
              tone={company.priority === 'DREAM' ? 'hot' : 'neutral'}
            />
          }
        />
        <Info label="Status" value={<StatusBadge value={company.status} />} />
        <Info label="Remote policy" value={company.remotePolicy ?? 'Not set'} />
        <Info label="Last scanned" value={formatDate(company.lastScannedAt)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid gap-6">
          <Section title="Jobs">
            {company.jobs.length ? (
              <>
                {matchingJobs.length ? (
                  matchingJobs.map(renderJob)
                ) : (
                  <p className="text-muted-foreground p-4 text-sm">
                    No roles match your current preferences.
                  </p>
                )}
                {otherJobs.length ? (
                  <details className="border-t">
                    <summary className="hover:bg-muted/50 cursor-pointer px-4 py-3 text-sm font-medium">
                      Other roles ({otherJobs.length})
                    </summary>
                    <div className="border-t">{otherJobs.map(renderJob)}</div>
                  </details>
                ) : null}
              </>
            ) : (
              <p className="text-muted-foreground p-4 text-sm">
                No jobs tracked for this company yet.
              </p>
            )}
          </Section>

          <Section title="Applications">
            {company.applications.length ? (
              company.applications.map((application) => (
                <div
                  key={application.id}
                  className="flex items-center justify-between gap-4 border-b px-4 py-3 last:border-b-0"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {application.job?.title ?? company.name}
                    </span>
                    <span className="text-muted-foreground block truncate text-xs">
                      Next follow-up: {formatDate(application.nextFollowUpAt)}
                    </span>
                  </span>
                  <StatusBadge value={application.status} />
                </div>
              ))
            ) : (
              <p className="text-muted-foreground p-4 text-sm">
                No applications for this company yet.
              </p>
            )}
          </Section>

          <Section title="Scan History">
            {company.scanHistory.length ? (
              company.scanHistory.map((scan) => (
                <div
                  key={scan.id}
                  className="flex items-center justify-between gap-4 border-b px-4 py-3 last:border-b-0"
                >
                  <span className="text-sm">{formatDate(scan.scannedAt)}</span>
                  <span className="text-muted-foreground text-sm">{scan.jobsFound} jobs</span>
                  <StatusBadge
                    value={scan.status}
                    tone={scan.status === 'SUCCESS' ? 'good' : 'warn'}
                  />
                </div>
              ))
            ) : (
              <p className="text-muted-foreground p-4 text-sm">No scans have run yet.</p>
            )}
          </Section>

          <Section title="Hiring Signals">
            {company.hiringSignals.length ? (
              company.hiringSignals.map((signal) => (
                <div
                  key={signal.id}
                  className="flex items-center justify-between gap-4 border-b px-4 py-3 last:border-b-0"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{signal.title}</span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {formatDate(signal.signalDate)}
                    </span>
                  </span>
                  <StatusBadge value={signal.type} />
                </div>
              ))
            ) : (
              <p className="text-muted-foreground p-4 text-sm">No hiring signals stored yet.</p>
            )}
          </Section>
        </div>

        <section className="bg-card rounded-lg border p-5">
          <h2 className="mb-4 text-lg font-semibold">Company Profile</h2>
          <CompanyForm company={company} />
        </section>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-card rounded-lg border p-4">
      <div className="text-muted-foreground text-xs font-medium uppercase">{label}</div>
      <div className="mt-2 text-sm font-medium">{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-card overflow-hidden rounded-lg border">
      <h2 className="border-b px-4 py-3 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}
