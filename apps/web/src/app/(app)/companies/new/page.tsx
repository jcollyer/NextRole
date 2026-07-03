import { CompanyForm } from '@/features/nextrole/forms';
import { PageHeader } from '@/features/nextrole/ui';

export default function NewCompanyPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Add Company" eyebrow="Target account" />
      <div className="rounded-lg border bg-card p-5">
        <CompanyForm />
      </div>
    </div>
  );
}
