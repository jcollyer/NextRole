import Link from 'next/link';
import type React from 'react';
import { redirect } from 'next/navigation';
import { ArrowUpRight, Building2, CalendarClock, Radar, Sparkles } from 'lucide-react';

import { prisma } from '@saas/db';

import { Button } from '@/components/ui/button';
import { auth } from '@/server/auth';
import { scanAllCompanies } from '@/features/nextrole/actions';
import { EmptyState, formatDate, PageHeader, scoreTone, StatusBadge } from '@/features/nextrole/ui';

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/');
  const userId = session.user.id;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const staleCutoff = new Date();
  staleCutoff.setDate(staleCutoff.getDate() - 14);

  const [newJobs, bestMatches, followUps, recentScans, staleCompanies, signals, counts] = await Promise.all([
    prisma.job.findMany({
      where: { userId, isNew: true, status: { notIn: ['DISMISSED', 'ARCHIVED'] } },
      include: { company: true },
      orderBy: { createdAt: 'desc' },
      take: 6,
    }),
    prisma.job.findMany({
      where: { userId, matchScore: { not: null }, status: { notIn: ['DISMISSED', 'ARCHIVED'] } },
      include: { company: true },
      orderBy: [{ matchScore: 'desc' }, { updatedAt: 'desc' }],
      take: 6,
    }),
    prisma.application.findMany({
      where: { userId, nextFollowUpAt: { lte: today }, status: { notIn: ['REJECTED', 'ARCHIVED'] } },
      include: { company: true, job: true },
      orderBy: { nextFollowUpAt: 'asc' },
      take: 6,
    }),
    prisma.scanHistory.findMany({
      where: { userId },
      include: { company: true },
      orderBy: { scannedAt: 'desc' },
      take: 5,
    }),
    prisma.company.findMany({
      where: {
        userId,
        status: { not: 'ARCHIVED' },
        OR: [{ lastScannedAt: null }, { lastScannedAt: { lt: staleCutoff } }],
      },
      orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
      take: 6,
    }),
    prisma.hiringSignal.findMany({
      where: { userId },
      include: { company: true },
      orderBy: [{ signalDate: 'desc' }, { createdAt: 'desc' }],
      take: 5,
    }),
    Promise.all([
      prisma.company.count({ where: { userId } }),
      prisma.job.count({ where: { userId } }),
      prisma.application.count({ where: { userId } }),
      prisma.hiringSignal.count({ where: { userId } }),
    ]),
  ]);

  return (
    <div>
      <PageHeader title="Morning Dashboard" eyebrow="NextRole">
        <form action={scanAllCompanies}>
          <Button type="submit" variant="outline">
            <Radar className="h-4 w-4" />
            Scan all
          </Button>
        </form>
        <Button asChild>
          <Link href="/jobs/new">Add job</Link>
        </Button>
      </PageHeader>

      <div className="mb-6 grid gap-3 md:grid-cols-4">
        <Metric icon={<Building2 className="h-4 w-4" />} label="Companies" value={counts[0]} />
        <Metric icon={<Sparkles className="h-4 w-4" />} label="Jobs" value={counts[1]} />
        <Metric icon={<CalendarClock className="h-4 w-4" />} label="Applications" value={counts[2]} />
        <Metric icon={<ArrowUpRight className="h-4 w-4" />} label="Signals" value={counts[3]} />
      </div>

      {counts[0] === 0 ? (
        <EmptyState
          title="Build your target-company list"
          body="Start with companies you care about, then add roles, scans, applications, and hiring signals as the search develops."
          href="/companies/new"
          action="Add first company"
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <Panel title="New Jobs">
            {newJobs.length ? (
              newJobs.map((job) => (
                <Row key={job.id} href="/jobs" title={job.title} meta={`${job.company.name} · ${job.location ?? 'Location TBD'}`}>
                  <StatusBadge value="New" tone="hot" />
                </Row>
              ))
            ) : (
              <Muted>No newly discovered jobs yet.</Muted>
            )}
          </Panel>

          <Panel title="Best Matches">
            {bestMatches.length ? (
              bestMatches.map((job) => (
                <Row key={job.id} href="/jobs" title={job.title} meta={job.company.name}>
                  <StatusBadge value={`${job.matchScore ?? 0}%`} tone={scoreTone(job.matchScore)} />
                </Row>
              ))
            ) : (
              <Muted>Analyze saved jobs to build the ranked match list.</Muted>
            )}
          </Panel>

          <Panel title="Follow-Ups Due">
            {followUps.length ? (
              followUps.map((application) => (
                <Row
                  key={application.id}
                  href="/follow-ups"
                  title={application.job?.title ?? application.company.name}
                  meta={`Due ${formatDate(application.nextFollowUpAt)}`}
                >
                  <StatusBadge value={application.status} tone="warn" />
                </Row>
              ))
            ) : (
              <Muted>No overdue follow-ups. The pipeline breathes.</Muted>
            )}
          </Panel>

          <Panel title="Companies To Scan">
            {staleCompanies.length ? (
              staleCompanies.map((company) => (
                <Row key={company.id} href={`/companies/${company.id}`} title={company.name} meta={`Last scan: ${formatDate(company.lastScannedAt)}`}>
                  <StatusBadge value={company.priority} tone={company.priority === 'DREAM' ? 'hot' : 'neutral'} />
                </Row>
              ))
            ) : (
              <Muted>All active companies have recent scan activity.</Muted>
            )}
          </Panel>

          <Panel title="Recent Scans">
            {recentScans.length ? (
              recentScans.map((scan) => (
                <Row key={scan.id} href={`/companies/${scan.companyId}`} title={scan.company.name} meta={`${scan.jobsFound} jobs found · ${formatDate(scan.scannedAt)}`}>
                  <StatusBadge value={scan.status} tone={scan.status === 'SUCCESS' ? 'good' : 'warn'} />
                </Row>
              ))
            ) : (
              <Muted>Run a company scan when a careers page is available.</Muted>
            )}
          </Panel>

          <Panel title="Hiring Signals">
            {signals.length ? (
              signals.map((signal) => (
                <Row key={signal.id} href="/signals" title={signal.title} meta={`${signal.company.name} · ${formatDate(signal.signalDate)}`}>
                  <StatusBadge value={signal.type} />
                </Row>
              ))
            ) : (
              <Muted>Add funding, launch, and hiring signals manually for now.</Muted>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-card">
      <h2 className="border-b px-4 py-3 text-sm font-semibold">{title}</h2>
      <div className="divide-y">{children}</div>
    </section>
  );
}

function Row({ href, title, meta, children }: { href: string; title: string; meta: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex min-h-16 items-center justify-between gap-4 px-4 py-3 hover:bg-muted/50">
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{title}</span>
        <span className="text-muted-foreground block truncate text-xs">{meta}</span>
      </span>
      {children}
    </Link>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground px-4 py-5 text-sm">{children}</p>;
}
