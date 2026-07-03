import Link from 'next/link';
import { redirect } from 'next/navigation';

import { prisma } from '@saas/db';

import { auth } from '@/server/auth';
import { ApplicationForm, ApplicationUpdateForm } from '@/features/nextrole/forms';
import { EmptyState, formatDate, PageHeader, StatusBadge } from '@/features/nextrole/ui';

export default async function ApplicationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/');
  const userId = session.user.id;

  const [companies, jobs, applications] = await Promise.all([
    prisma.company.findMany({ where: { userId }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.job.findMany({ where: { userId }, orderBy: { title: 'asc' }, select: { id: true, title: true, companyId: true } }),
    prisma.application.findMany({
      where: { userId },
      include: { company: true, job: true },
      orderBy: [{ nextFollowUpAt: 'asc' }, { updatedAt: 'desc' }],
    }),
  ]);

  return (
    <div>
      <PageHeader title="Applications" eyebrow="Pipeline tracker" />

      {companies.length ? (
        <section className="mb-6 rounded-lg border bg-card p-5">
          <h2 className="mb-4 text-lg font-semibold">Track Application</h2>
          <ApplicationForm companies={companies} jobs={jobs} />
        </section>
      ) : null}

      {applications.length ? (
        <div className="grid gap-4">
          {applications.map((application) => (
            <section key={application.id} className="rounded-lg border bg-card p-4">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="font-semibold">{application.job?.title ?? application.company.name}</h2>
                  <p className="text-muted-foreground text-sm">
                    <Link href={`/companies/${application.companyId}`} className="text-foreground hover:underline">
                      {application.company.name}
                    </Link>{' '}
                    · Applied {formatDate(application.appliedAt)} · Follow-up {formatDate(application.nextFollowUpAt)}
                  </p>
                </div>
                <StatusBadge value={application.status} />
              </div>
              <ApplicationUpdateForm application={application} />
              {application.notes ? <p className="text-muted-foreground mt-3 text-sm">{application.notes}</p> : null}
            </section>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No applications tracked"
          body="When a saved job turns into an application, track the stage and next follow-up date here."
          href={companies.length ? '/jobs' : '/companies/new'}
          action={companies.length ? 'Review jobs' : 'Add company'}
        />
      )}
    </div>
  );
}
