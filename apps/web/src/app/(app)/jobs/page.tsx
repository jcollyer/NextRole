import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ExternalLink, Plus, Sparkles, Trash2 } from 'lucide-react';

import { prisma } from '@saas/db';

import { Button } from '@/components/ui/button';
import { auth } from '@/server/auth';
import { analyzeJob, deleteJob } from '@/features/nextrole/actions';
import { EmptyState, formatDate, PageHeader, scoreTone, StatusBadge } from '@/features/nextrole/ui';

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/');
  const { companyId } = await searchParams;

  const [selectedCompany, jobs] = await Promise.all([
    companyId
      ? prisma.company.findFirst({
          where: { id: companyId, userId: session.user.id },
          select: { id: true, name: true },
        })
      : null,
    prisma.job.findMany({
      where: { userId: session.user.id, ...(companyId ? { companyId } : {}) },
      include: { company: true },
      orderBy: [{ isNew: 'desc' }, { matchScore: 'desc' }, { createdAt: 'desc' }],
    }),
  ]);

  if (companyId && !selectedCompany) redirect('/jobs');

  return (
    <div>
      <PageHeader title="Jobs" eyebrow={selectedCompany ? `Roles for ${selectedCompany.name}` : 'Discovered and saved roles'}>
        {selectedCompany ? (
          <Button asChild variant="outline">
            <Link href="/jobs">All jobs</Link>
          </Button>
        ) : null}
        <Button asChild>
          <Link href="/jobs/new">
            <Plus className="h-4 w-4" />
            Add job
          </Link>
        </Button>
      </PageHeader>

      {jobs.length ? (
        <div className="grid gap-4">
          {jobs.map((job) => (
            <section key={job.id} className="rounded-lg border bg-card p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-lg font-semibold">{job.title}</h2>
                    {job.isNew ? <StatusBadge value="New" tone="hot" /> : null}
                    <StatusBadge value={job.status} />
                    {job.matchScore == null ? null : <StatusBadge value={`${job.matchScore}% match`} tone={scoreTone(job.matchScore)} />}
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm">
                    <Link href={`/companies/${job.companyId}`} className="font-medium text-foreground hover:underline">
                      {job.company.name}
                    </Link>{' '}
                    · {job.location ?? 'Location TBD'} · Found {formatDate(job.dateFound)}
                  </p>
                  {job.aiSummary ? <p className="mt-3 text-sm">{job.aiSummary}</p> : null}
                  {job.aiFitReason ? <p className="text-muted-foreground mt-2 text-sm">{job.aiFitReason}</p> : null}
                  {job.extractedKeywords.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {job.extractedKeywords.map((keyword) => (
                        <span key={keyword} className="rounded-md bg-muted px-2 py-1 text-xs">
                          {keyword}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {job.url ? (
                    <Button asChild variant="outline" size="sm">
                      <a href={job.url} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4" />
                        Open
                      </a>
                    </Button>
                  ) : null}
                  <form action={analyzeJob}>
                    <input type="hidden" name="id" value={job.id} />
                    <Button type="submit" variant="outline" size="sm">
                      <Sparkles className="h-4 w-4" />
                      Analyze
                    </Button>
                  </form>
                  <form action={deleteJob}>
                    <input type="hidden" name="id" value={job.id} />
                    <Button type="submit" variant="outline" size="sm">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </form>
                </div>
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState
          title={selectedCompany ? 'No jobs for this company yet' : 'No jobs yet'}
          body={
            selectedCompany
              ? 'Run a company scan again or add a role manually when you find one.'
              : 'Add a role manually or scan a company careers page to start building the opportunity list.'
          }
          href={selectedCompany ? `/companies/${selectedCompany.id}` : '/jobs/new'}
          action={selectedCompany ? 'Back to company' : 'Add job'}
        />
      )}
    </div>
  );
}
