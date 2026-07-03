import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ExternalLink } from 'lucide-react';

import { prisma } from '@saas/db';

import { Button } from '@/components/ui/button';
import { auth } from '@/server/auth';
import { SignalForm } from '@/features/nextrole/forms';
import { EmptyState, formatDate, PageHeader, StatusBadge } from '@/features/nextrole/ui';

export default async function SignalsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/');
  const userId = session.user.id;

  const [companies, signals] = await Promise.all([
    prisma.company.findMany({ where: { userId }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.hiringSignal.findMany({
      where: { userId },
      include: { company: true },
      orderBy: [{ signalDate: 'desc' }, { createdAt: 'desc' }],
    }),
  ]);

  return (
    <div>
      <PageHeader title="Hiring Signals" eyebrow="Funding, launches, and market movement" />

      {companies.length ? (
        <section className="mb-6 rounded-lg border bg-card p-5">
          <h2 className="mb-4 text-lg font-semibold">Add Signal</h2>
          <SignalForm companies={companies} />
        </section>
      ) : null}

      {signals.length ? (
        <div className="grid gap-4">
          {signals.map((signal) => (
            <section key={signal.id} className="rounded-lg border bg-card p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">{signal.title}</h2>
                    <StatusBadge value={signal.type} />
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm">
                    <Link href={`/companies/${signal.companyId}`} className="text-foreground hover:underline">
                      {signal.company.name}
                    </Link>{' '}
                    · {formatDate(signal.signalDate)}
                  </p>
                  {signal.notes ? <p className="text-muted-foreground mt-3 text-sm">{signal.notes}</p> : null}
                </div>
                {signal.sourceUrl ? (
                  <Button asChild variant="outline" size="sm">
                    <a href={signal.sourceUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4" />
                      Source
                    </a>
                  </Button>
                ) : null}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No hiring signals yet"
          body="Store funding rounds, product launches, founder posts, and other signals that make outreach timely."
          href={companies.length ? undefined : '/companies/new'}
          action={companies.length ? undefined : 'Add company'}
        />
      )}
    </div>
  );
}
