import { Button } from '@/components/ui/button';

import {
  createApplication,
  createCompany,
  createHiringSignal,
  createJob,
  updateApplication,
  updateCompany,
} from './actions';
import { applicationStatuses, companyPriorities, companyStatuses, signalTypes } from './constants';
import { dateInputValue, Field, SelectField, TextArea } from './ui';

type CompanyOption = { id: string; name: string };
type JobOption = { id: string; title: string; companyId: string };

export function CompanyForm({
  company,
}: {
  company?: {
    id: string;
    name: string;
    website: string | null;
    careersUrl: string | null;
    category: string | null;
    stage: string | null;
    location: string | null;
    remotePolicy: string | null;
    fundingStatus: string | null;
    notes: string | null;
    priority: string;
    status: string;
  };
}) {
  return (
    <form action={company ? updateCompany : createCompany} className="grid gap-5">
      {company ? <input type="hidden" name="id" value={company.id} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Company name" name="name" defaultValue={company?.name} required />
        <Field label="Website" name="website" defaultValue={company?.website} placeholder="https://example.com" />
        <Field label="Careers page URL" name="careersUrl" defaultValue={company?.careersUrl} placeholder="https://example.com/careers" />
        <Field label="Category" name="category" defaultValue={company?.category} placeholder="FinTech" />
        <Field label="Stage" name="stage" defaultValue={company?.stage} placeholder="Series B" />
        <Field label="Location" name="location" defaultValue={company?.location} placeholder="Remote / San Francisco" />
        <Field label="Remote policy" name="remotePolicy" defaultValue={company?.remotePolicy} placeholder="Remote, hybrid, onsite" />
        <Field label="Funding status" name="fundingStatus" defaultValue={company?.fundingStatus} placeholder="Raised Series C in 2026" />
        <SelectField label="Priority" name="priority" defaultValue={company?.priority} options={companyPriorities} />
        <SelectField label="Status" name="status" defaultValue={company?.status} options={companyStatuses} />
      </div>
      <TextArea label="Notes" name="notes" defaultValue={company?.notes} placeholder="Why this company matters, contacts, product notes..." />
      <Button type="submit">{company ? 'Save company' : 'Create company'}</Button>
    </form>
  );
}

export function JobForm({ companies }: { companies: CompanyOption[] }) {
  return (
    <form action={createJob} className="grid gap-5">
      <label className="grid gap-2 text-sm font-medium">
        Company
        <select name="companyId" required className="border-input bg-background h-10 rounded-md border px-3 text-sm">
          <option value="">Select company</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Job title" name="title" required />
        <Field label="Job URL" name="url" placeholder="https://..." />
        <Field label="Location" name="location" placeholder="Remote / San Francisco" />
        <Field label="Remote or hybrid status" name="remotePolicy" placeholder="Remote" />
        <Field label="Source" name="source" defaultValue="Manual" />
        <Field label="Date found" name="dateFound" type="date" defaultValue={dateInputValue(new Date())} />
      </div>
      <TextArea label="Description" name="description" rows={8} placeholder="Paste the role description or notes." />
      <Button type="submit">Save job</Button>
    </form>
  );
}

export function ApplicationForm({ companies, jobs }: { companies: CompanyOption[]; jobs: JobOption[] }) {
  return (
    <form action={createApplication} className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">
          Company
          <select name="companyId" required className="border-input bg-background h-10 rounded-md border px-3 text-sm">
            <option value="">Select company</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Job
          <select name="jobId" className="border-input bg-background h-10 rounded-md border px-3 text-sm">
            <option value="">No linked job</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title}
              </option>
            ))}
          </select>
        </label>
        <SelectField label="Status" name="status" defaultValue="APPLIED" options={applicationStatuses} />
        <Field label="Applied date" name="appliedAt" type="date" />
        <Field label="Last follow-up" name="lastFollowUpAt" type="date" />
        <Field label="Next follow-up" name="nextFollowUpAt" type="date" />
        <Field label="Recruiter contact" name="recruiterContact" placeholder="name@example.com" />
        <Field label="Referral contact" name="referralContact" placeholder="Name or email" />
      </div>
      <TextArea label="Notes" name="notes" placeholder="Conversation history, next step, prep notes..." />
      <Button type="submit">Track application</Button>
    </form>
  );
}

export function ApplicationUpdateForm({
  application,
}: {
  application: {
    id: string;
    status: string;
    lastFollowUpAt: Date | null;
    nextFollowUpAt: Date | null;
    recruiterContact: string | null;
    referralContact: string | null;
    notes: string | null;
  };
}) {
  return (
    <form action={updateApplication} className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
      <input type="hidden" name="id" value={application.id} />
      <SelectField label="Status" name="status" defaultValue={application.status} options={applicationStatuses} />
      <Field label="Last follow-up" name="lastFollowUpAt" type="date" defaultValue={dateInputValue(application.lastFollowUpAt)} />
      <Field label="Next follow-up" name="nextFollowUpAt" type="date" defaultValue={dateInputValue(application.nextFollowUpAt)} />
      <input type="hidden" name="recruiterContact" value={application.recruiterContact ?? ''} />
      <input type="hidden" name="referralContact" value={application.referralContact ?? ''} />
      <input type="hidden" name="notes" value={application.notes ?? ''} />
      <Button type="submit">Update</Button>
    </form>
  );
}

export function SignalForm({ companies }: { companies: CompanyOption[] }) {
  return (
    <form action={createHiringSignal} className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">
          Company
          <select name="companyId" required className="border-input bg-background h-10 rounded-md border px-3 text-sm">
            <option value="">Select company</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </label>
        <SelectField label="Signal type" name="type" defaultValue="FUNDING" options={signalTypes} />
        <Field label="Title" name="title" required placeholder="Series B announcement" />
        <Field label="Source URL" name="sourceUrl" placeholder="https://..." />
        <Field label="Signal date" name="signalDate" type="date" />
      </div>
      <TextArea label="Notes" name="notes" placeholder="Why this signal matters." />
      <Button type="submit">Save signal</Button>
    </form>
  );
}
