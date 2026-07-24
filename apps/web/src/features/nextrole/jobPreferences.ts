type JobPreferenceUser = {
  workArrangements: string[];
  preferredLocations: string[];
  roleFamilies: string[];
  includedTitleTerms: string[];
  excludedTitleTerms: string[];
  seniorityLevels: string[];
};

type PreferenceJob = {
  title: string;
  location: string | null;
  remotePolicy: string | null;
};

const familyTerms: Record<string, string[]> = {
  FRONTEND: ['frontend', 'front-end', 'ui engineer', 'web engineer', 'react'],
  FULL_STACK: ['full stack', 'full-stack'],
  PRODUCT_ENGINEERING: ['product engineer', 'product software engineer'],
  BACKEND: ['backend', 'back-end', 'server engineer', 'platform engineer'],
  MOBILE: ['mobile engineer', 'ios', 'android', 'react native'],
  DESIGN: ['product designer', 'ux designer', 'ui designer'],
};

const seniorityTerms: Record<string, string[]> = {
  MID: ['engineer ii', 'software engineer ii', 'mid-level', 'mid level'],
  SENIOR: ['senior', 'sr. ', 'sr '],
  STAFF: ['staff'],
  PRINCIPAL: ['principal'],
  LEAD: ['lead'],
  MANAGER: ['manager', 'head of', 'director'],
};

const normalize = (value: string) => value.trim().toLowerCase();

export function jobMatchesPreferences(job: PreferenceJob, preferences: JobPreferenceUser) {
  const title = normalize(job.title);
  const location = normalize(`${job.location ?? ''} ${job.remotePolicy ?? ''}`);
  const excluded = preferences.excludedTitleTerms.map(normalize).filter(Boolean);
  const included = preferences.includedTitleTerms.map(normalize).filter(Boolean);

  if (excluded.some((term) => title.includes(term))) return false;
  if (preferences.workArrangements.length) {
    const isHybrid = /hybrid/.test(location);
    const isRemote = !isHybrid && /remote|anywhere|distributed/.test(location);
    const isOnsite = !isHybrid && !isRemote && Boolean(location);
    const arrangementMatches =
      (preferences.workArrangements.includes('REMOTE') && isRemote) ||
      (preferences.workArrangements.includes('HYBRID') && isHybrid) ||
      (preferences.workArrangements.includes('ONSITE') && isOnsite);
    if (!arrangementMatches) return false;
  }

  if (preferences.preferredLocations.length) {
    const locationMatches = preferences.preferredLocations
      .map(normalize)
      .some((place) => location.includes(place));
    const isRemote = /remote|anywhere|distributed/.test(location);
    if (!locationMatches && !isRemote) return false;
  }

  if (preferences.roleFamilies.length || included.length) {
    const matchesFamily = preferences.roleFamilies.some((family) =>
      (familyTerms[family] ?? []).some((term) => title.includes(term)),
    );
    if (!matchesFamily && !included.some((term) => title.includes(term))) return false;
  }

  if (
    preferences.seniorityLevels.length &&
    !preferences.seniorityLevels.some((level) =>
      (seniorityTerms[level] ?? []).some((term) => title.includes(term)),
    )
  ) {
    return false;
  }

  return true;
}
