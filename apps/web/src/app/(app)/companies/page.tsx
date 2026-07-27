import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Plus, Upload } from 'lucide-react';

import { prisma } from '@saas/db';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { auth } from '@/server/auth';
import { scanAllCompanies, scanCompany } from '@/features/nextrole/actions';
import { jobMatchesPreferences } from '@/features/nextrole/jobPreferences';
import { ScanAllCompaniesButton } from '@/features/nextrole/ScanAllCompaniesButton';
import { EmptyState, formatDate, PageHeader, StatusBadge } from '@/features/nextrole/ui';

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{
    imported?: string;
    scanResult?: string;
    scanned?: string;
    found?: string;
    matched?: string;
    failed?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/');
  const { imported, scanResult, scanned, found, matched, failed } = await searchParams;

  const [preferences, companies] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: session.user.id },
      select: {
        workArrangements: true,
        preferredLocations: true,
        roleFamilies: true,
        includedTitleTerms: true,
        excludedTitleTerms: true,
        seniorityLevels: true,
      },
    }),
    prisma.company.findMany({
      where: { userId: session.user.id },
      include: {
        jobs: {
          where: { discoveredByScan: true, isCurrent: true },
          select: { title: true, location: true, remotePolicy: true },
        },
        _count: {
          select: {
            jobs: { where: { OR: [{ discoveredByScan: false }, { isCurrent: true }] } },
            applications: true,
            hiringSignals: true,
          },
        },
        scanHistory: {
          orderBy: { scannedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
    }),
  ]);
  const scannableCompanies = companies.filter((company) => company.careersUrl).length;

  return (
    <div>
      <PageHeader title="Companies" eyebrow={imported ? `${imported} rows imported` : 'Target account list'}>
        <form action={scanAllCompanies}>
          <ScanAllCompaniesButton disabled={scannableCompanies === 0} />
        </form>
        <Button asChild variant="outline">
          <Link href="/import">
            <Upload className="h-4 w-4" />
            Import CSV
          </Link>
        </Button>
        <Button asChild>
          <Link href="/companies/new">
            <Plus className="h-4 w-4" />
            Add company
          </Link>
        </Button>
      </PageHeader>

      {scanResult ? (
        <div
          className={cn(
            'mb-4 rounded-lg border p-3 text-sm',
            scanResult === 'complete'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-amber-200 bg-amber-50 text-amber-800',
          )}
        >
          {scanResult === 'complete'
            ? `Scan complete: ${scanned ?? 0} companies scanned, ${found ?? 0} jobs found, ${matched ?? 0} matching your filters, ${failed ?? 0} failed.`
            : 'No companies with careers URLs are ready to scan yet.'}
        </div>
      ) : null}

      {companies.length ? (
        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="grid grid-cols-[minmax(220px,1.3fr)_minmax(140px,0.8fr)_110px_minmax(220px,1.1fr)_140px] gap-4 border-b px-4 py-3 text-xs font-medium uppercase text-muted-foreground max-lg:hidden">
            <span>Company</span>
            <span>Category</span>
            <span>Priority</span>
            <span>Scan history</span>
            <span>Actions</span>
          </div>
          <div className="divide-y">
            {companies.map((company) => {
              const latestScan = company.scanHistory[0];
              const matchingJobs = company.jobs.filter((job) =>
                jobMatchesPreferences(job, preferences),
              ).length;
              const hasMatchingJobs = latestScan?.status === 'SUCCESS' && matchingJobs > 0;

              return (
                <div
                  key={company.id}
                  className={cn(
                    'grid gap-3 px-4 py-4 lg:grid-cols-[minmax(220px,1.3fr)_minmax(140px,0.8fr)_110px_minmax(220px,1.1fr)_140px] lg:items-center',
                    hasMatchingJobs && 'bg-emerald-50/70 ring-1 ring-inset ring-emerald-200',
                  )}
                >
                  <Link href={`/companies/${company.id}`} className="min-w-0">
                    <span className="block truncate font-medium">{company.name}</span>
                    <span className="text-muted-foreground block truncate text-sm">
                      {company.location ?? 'Location TBD'} · {company._count.jobs} jobs · {company._count.applications} apps
                    </span>
                  </Link>
                  <span className="text-sm">{company.category ?? 'Uncategorized'}</span>
                  <StatusBadge value={company.priority} tone={company.priority === 'DREAM' ? 'hot' : 'neutral'} />
                  <div className="min-w-0">
                    {latestScan ? (
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge value={latestScan.status} tone={latestScan.status === 'SUCCESS' ? 'good' : 'warn'} />
                          <span className="text-muted-foreground text-sm">{formatDate(latestScan.scannedAt)}</span>
                        </div>
                        <p className={cn('truncate text-xs', hasMatchingJobs ? 'font-medium text-emerald-700' : 'text-muted-foreground')}>
                          {latestScan.status === 'SUCCESS'
                            ? `${matchingJobs} matching · ${latestScan.jobsFound} total found`
                            : latestScan.errorMessage ?? 'Scan failed'}
                        </p>
                        {hasMatchingJobs ? (
                          <Link href={`/jobs?companyId=${company.id}`} className="text-xs font-medium text-emerald-700 hover:underline">
                            View job descriptions
                          </Link>
                        ) : null}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <span className="text-muted-foreground text-sm">No scans yet</span>
                        <p className="text-muted-foreground truncate text-xs">
                          {company.careersUrl ? 'Ready to scan' : 'Add a careers URL to scan'}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/companies/${company.id}`}>Open</Link>
                    </Button>
                    <form action={scanCompany}>
                      <input type="hidden" name="companyId" value={company.id} />
                      <Button type="submit" variant="outline" size="sm" disabled={!company.careersUrl}>
                        Scan
                      </Button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <EmptyState
          title="No companies yet"
          body="Add target companies manually or import a CSV to turn the template into your job-search CRM."
          href="/companies/new"
          action="Add company"
        />
      )}
    </div>
  );
}
