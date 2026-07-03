import Link from 'next/link';
import { redirect } from 'next/navigation';

import { prisma } from '@saas/db';

import { Button } from '@/components/ui/button';
import { auth } from '@/server/auth';
import { JobForm } from '@/features/nextrole/forms';
import { EmptyState, PageHeader } from '@/features/nextrole/ui';

export default async function NewJobPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/');

  const companies = await prisma.company.findMany({
    where: { userId: session.user.id },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Add Job" eyebrow="Manual role entry" />
      {companies.length ? (
        <div className="rounded-lg border bg-card p-5">
          <JobForm companies={companies} />
        </div>
      ) : (
        <EmptyState
          title="Add a company first"
          body="Jobs are tracked against companies so follow-ups, scans, and signals stay connected."
          href="/companies/new"
          action="Add company"
        />
      )}
      <div className="mt-4">
        <Button asChild variant="ghost">
          <Link href="/jobs">Back to jobs</Link>
        </Button>
      </div>
    </div>
  );
}
