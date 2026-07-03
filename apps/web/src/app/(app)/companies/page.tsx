import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Plus, Upload } from 'lucide-react';

import { prisma } from '@saas/db';

import { Button } from '@/components/ui/button';
import { auth } from '@/server/auth';
import { scanCompany } from '@/features/nextrole/actions';
import { EmptyState, formatDate, PageHeader, StatusBadge } from '@/features/nextrole/ui';

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ imported?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/');
  const { imported } = await searchParams;

  const companies = await prisma.company.findMany({
    where: { userId: session.user.id },
    include: { _count: { select: { jobs: true, applications: true, hiringSignals: true } } },
    orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
  });

  return (
    <div>
      <PageHeader title="Companies" eyebrow={imported ? `${imported} rows imported` : 'Target account list'}>
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

      {companies.length ? (
        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="grid grid-cols-[minmax(220px,1.4fr)_1fr_120px_140px_140px] gap-4 border-b px-4 py-3 text-xs font-medium uppercase text-muted-foreground max-lg:hidden">
            <span>Company</span>
            <span>Category</span>
            <span>Priority</span>
            <span>Last scan</span>
            <span>Actions</span>
          </div>
          <div className="divide-y">
            {companies.map((company) => (
              <div key={company.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[minmax(220px,1.4fr)_1fr_120px_140px_140px] lg:items-center">
                <Link href={`/companies/${company.id}`} className="min-w-0">
                  <span className="block truncate font-medium">{company.name}</span>
                  <span className="text-muted-foreground block truncate text-sm">
                    {company.location ?? 'Location TBD'} · {company._count.jobs} jobs · {company._count.applications} apps
                  </span>
                </Link>
                <span className="text-sm">{company.category ?? 'Uncategorized'}</span>
                <StatusBadge value={company.priority} tone={company.priority === 'DREAM' ? 'hot' : 'neutral'} />
                <span className="text-muted-foreground text-sm">{formatDate(company.lastScannedAt)}</span>
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
            ))}
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
