import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';

import { prisma } from '@saas/db';

import { Button } from '@/components/ui/button';
import { auth } from '@/server/auth';
import { markFollowUpComplete } from '@/features/nextrole/actions';
import { dateInputValue, EmptyState, formatDate, PageHeader, StatusBadge, TextArea } from '@/features/nextrole/ui';

export default async function FollowUpsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/');

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const applications = await prisma.application.findMany({
    where: {
      userId: session.user.id,
      nextFollowUpAt: { lte: today },
      status: { notIn: ['REJECTED', 'ARCHIVED'] },
    },
    include: { company: true, job: true },
    orderBy: { nextFollowUpAt: 'asc' },
  });

  return (
    <div>
      <PageHeader title="Follow-Ups" eyebrow="Due today and overdue" />
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
                    · Due {formatDate(application.nextFollowUpAt)}
                  </p>
                </div>
                <StatusBadge value={application.status} tone="warn" />
              </div>
              <form action={markFollowUpComplete} className="grid gap-3 md:grid-cols-[1fr_220px_auto] md:items-end">
                <input type="hidden" name="id" value={application.id} />
                <TextArea label="Follow-up notes" name="notes" defaultValue={application.notes} rows={2} />
                <label className="grid gap-2 text-sm font-medium">
                  Next follow-up
                  <input
                    name="nextFollowUpAt"
                    type="date"
                    defaultValue={dateInputValue(addDays(new Date(), 7))}
                    className="border-input bg-background h-10 rounded-md border px-3 text-sm"
                  />
                </label>
                <Button type="submit">
                  <CheckCircle2 className="h-4 w-4" />
                  Complete
                </Button>
              </form>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No follow-ups due"
          body="Applications with a next follow-up date of today or earlier will show up here."
          href="/applications"
          action="Open applications"
        />
      )}
    </div>
  );
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
