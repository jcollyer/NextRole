import { CsvImport } from '@/features/nextrole/CsvImport';
import { PageHeader } from '@/features/nextrole/ui';

export default function ImportPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Import Companies" eyebrow="CSV upload" />
      <section className="rounded-lg border bg-card p-5">
        <CsvImport />
      </section>
    </div>
  );
}
