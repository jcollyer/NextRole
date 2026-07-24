'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getInitials } from '@/lib/utils';
import { trpc } from '@/lib/trpc/client';

import { DeleteAccountDialog } from './DeleteAccountDialog';
import { signOutAfterAccountDelete } from './actions';

/**
 * /settings — shows the user's profile info, lets them edit their display
 * name, and exposes a guarded "delete account" flow.
 */
export function SettingsView() {
  const router = useRouter();
  const utils = trpc.useUtils();

  const { data: me, isLoading } = trpc.user.me.useQuery();

  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [workArrangements, setWorkArrangements] = useState<string[]>([]);
  const [preferredLocations, setPreferredLocations] = useState('');
  const [roleFamilies, setRoleFamilies] = useState<string[]>([]);
  const [includedTitleTerms, setIncludedTitleTerms] = useState('');
  const [excludedTitleTerms, setExcludedTitleTerms] = useState('');
  const [seniorityLevels, setSeniorityLevels] = useState<string[]>([]);
  const [preferencesSaved, setPreferencesSaved] = useState(false);
  const [preferencesError, setPreferencesError] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Sync the input from the server, but only when the server value changes so
  // a slow refetch doesn't clobber mid-edit text.
  useEffect(() => {
    if (me?.name != null) setName(me.name);
  }, [me?.name]);

  useEffect(() => {
    if (!me) return;
    setWorkArrangements(me.workArrangements);
    setPreferredLocations(me.preferredLocations.join(', '));
    setRoleFamilies(me.roleFamilies);
    setIncludedTitleTerms(me.includedTitleTerms.join(', '));
    setExcludedTitleTerms(me.excludedTitleTerms.join(', '));
    setSeniorityLevels(me.seniorityLevels);
  }, [me]);

  const updateProfile = trpc.user.updateProfile.useMutation({
    onSuccess: () => {
      utils.user.me.invalidate();
      utils.user.getSession.invalidate();
      setSavedAt(Date.now());
      // Refresh the server layout so the nav avatar/name updates immediately.
      router.refresh();
    },
    onError: (err) => setError(err.message),
  });

  const deleteAccount = trpc.user.deleteAccount.useMutation({
    onSuccess: async () => {
      await signOutAfterAccountDelete();
    },
    onError: (err) => {
      setDeleteError(err.message);
      setIsDeleting(false);
    },
  });

  const updateJobPreferences = trpc.user.updateJobPreferences.useMutation({
    onSuccess: () => {
      utils.user.me.invalidate();
      setPreferencesSaved(true);
      router.refresh();
    },
    onError: (err) => setPreferencesError(err.message),
  });

  const trimmed = name.trim();
  const dirty = trimmed.length > 0 && trimmed !== (me?.name ?? '');
  const initials = getInitials(trimmed || me?.name || me?.email);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!dirty) return;
    updateProfile.mutate({ name: trimmed });
  }

  const memberSince = me?.createdAt
    ? new Date(me.createdAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update how your name appears across the app.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex items-center gap-4">
                <span className="bg-primary/15 text-primary relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full text-xl font-semibold">
                  {me?.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={me.image}
                      alt="Your avatar"
                      className="absolute inset-0 h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span>{initials}</span>
                  )}
                </span>
                <div className="text-muted-foreground text-sm">
                  {memberSince ? <p>Member since {memberSince}</p> : null}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="settings-name">Name</Label>
                <Input
                  id="settings-name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError(null);
                    setSavedAt(null);
                  }}
                  placeholder="Your name"
                  autoComplete="name"
                  maxLength={80}
                />
                {error ? <p className="text-destructive text-sm">{error}</p> : null}
                {savedAt && !dirty ? <p className="text-muted-foreground text-sm">Saved.</p> : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="settings-email">Email</Label>
                <Input
                  id="settings-email"
                  value={me?.email ?? ''}
                  disabled
                  readOnly
                  className="opacity-70"
                />
                <p className="text-muted-foreground text-xs">
                  Your email is tied to your sign-in and can&apos;t be changed here.
                </p>
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={!dirty || updateProfile.isPending}>
                  {updateProfile.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    'Save changes'
                  )}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Job preferences</CardTitle>
          <CardDescription>
            Use these preferences to separate likely matches from other roles on company pages.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : (
            <form
              className="space-y-6"
              onSubmit={(event) => {
                event.preventDefault();
                setPreferencesError(null);
                setPreferencesSaved(false);
                updateJobPreferences.mutate({
                  workArrangements: workArrangements as ('REMOTE' | 'HYBRID' | 'ONSITE')[],
                  preferredLocations: commaList(preferredLocations),
                  roleFamilies: roleFamilies as (
                    | 'FRONTEND'
                    | 'FULL_STACK'
                    | 'PRODUCT_ENGINEERING'
                    | 'BACKEND'
                    | 'MOBILE'
                    | 'DESIGN'
                  )[],
                  includedTitleTerms: commaList(includedTitleTerms),
                  excludedTitleTerms: commaList(excludedTitleTerms),
                  seniorityLevels: seniorityLevels as (
                    | 'MID'
                    | 'SENIOR'
                    | 'STAFF'
                    | 'PRINCIPAL'
                    | 'LEAD'
                    | 'MANAGER'
                  )[],
                });
              }}
            >
              <PreferenceChecks
                label="Work arrangements"
                values={workArrangements}
                onChange={setWorkArrangements}
                options={[
                  ['REMOTE', 'Remote'],
                  ['HYBRID', 'Hybrid'],
                  ['ONSITE', 'On-site'],
                ]}
              />

              <PreferenceChecks
                label="Role families"
                values={roleFamilies}
                onChange={setRoleFamilies}
                options={[
                  ['FRONTEND', 'Frontend'],
                  ['FULL_STACK', 'Full-stack'],
                  ['PRODUCT_ENGINEERING', 'Product engineering'],
                  ['BACKEND', 'Backend / platform'],
                  ['MOBILE', 'Mobile'],
                  ['DESIGN', 'Product design'],
                ]}
              />

              <PreferenceChecks
                label="Seniority"
                values={seniorityLevels}
                onChange={setSeniorityLevels}
                options={[
                  ['MID', 'Mid-level'],
                  ['SENIOR', 'Senior'],
                  ['STAFF', 'Staff'],
                  ['PRINCIPAL', 'Principal'],
                  ['LEAD', 'Lead'],
                  ['MANAGER', 'Manager / director'],
                ]}
              />

              <CommaField
                id="preferred-locations"
                label="Preferred locations"
                value={preferredLocations}
                onChange={setPreferredLocations}
                placeholder="San Francisco, Bay Area, California"
                help="Comma-separated. Remote roles are still treated as location matches."
              />
              <CommaField
                id="included-title-terms"
                label="Additional desired title terms"
                value={includedTitleTerms}
                onChange={setIncludedTitleTerms}
                placeholder="design systems, UI platform"
                help="A title matching one of these can qualify even when it is outside the selected role families."
              />
              <CommaField
                id="excluded-title-terms"
                label="Excluded title terms"
                value={excludedTitleTerms}
                onChange={setExcludedTitleTerms}
                placeholder="product manager, technical support, machine learning, forward deployed"
                help="A matching title is always placed under Other roles."
              />

              {preferencesError ? (
                <p className="text-destructive text-sm">{preferencesError}</p>
              ) : null}
              {preferencesSaved ? (
                <p className="text-muted-foreground text-sm">Preferences saved.</p>
              ) : null}
              <div className="flex justify-end">
                <Button type="submit" disabled={updateJobPreferences.isPending}>
                  {updateJobPreferences.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    'Save preferences'
                  )}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Delete account</CardTitle>
          <CardDescription>
            This action is permanent and cannot be undone. All of your data will be permanently
            removed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border-destructive/30 bg-destructive/5 flex flex-col items-start justify-between gap-3 rounded-md border p-4 sm:flex-row sm:items-center">
            <div className="space-y-1">
              <p className="text-sm font-medium leading-none">Permanently delete this account</p>
              <p className="text-muted-foreground text-sm">
                You&apos;ll be signed out immediately and won&apos;t be able to recover your data.
              </p>
            </div>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="gap-2"
              onClick={() => {
                setDeleteError(null);
                setIsDeleting(false);
                setDeleteOpen(true);
              }}
              disabled={!me?.email}
            >
              <Trash2 className="h-4 w-4" />
              Delete account
            </Button>
          </div>
        </CardContent>
      </Card>

      <DeleteAccountDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setDeleteError(null);
        }}
        expectedEmail={me?.email ?? ''}
        isPending={isDeleting}
        errorMessage={deleteError}
        onConfirm={() => {
          if (!me?.email) return;
          setDeleteError(null);
          setIsDeleting(true);
          deleteAccount.mutate({ confirmEmail: me.email });
        }}
      />
    </div>
  );
}

function commaList(value: string) {
  return [
    ...new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

function PreferenceChecks({
  label,
  values,
  onChange,
  options,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  options: Array<readonly [string, string]>;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map(([value, text]) => (
          <label key={value} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={values.includes(value)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...values, value]
                    : values.filter((item) => item !== value),
                )
              }
              className="h-4 w-4 rounded border"
            />
            {text}
          </label>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">Leave all unchecked to accept any option.</p>
    </fieldset>
  );
}

function CommaField({
  id,
  label,
  value,
  onChange,
  placeholder,
  help,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  help: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
      <p className="text-muted-foreground text-xs">{help}</p>
    </div>
  );
}
