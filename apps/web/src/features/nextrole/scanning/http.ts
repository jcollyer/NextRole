const userAgent = 'NextRole manual job checker; contact: local-user';

export async function fetchCareersPage(url: string, timeoutMs = 15000) {
  const response = await fetch(url, {
    headers: {
      'user-agent': userAgent,
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: AbortSignal.timeout(timeoutMs),
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    throw new Error(`Careers page returned ${response.status}`);
  }

  return response.text();
}

/**
 * Job board APIs are best-effort: a miss on one provider should never fail the scan,
 * so every failure resolves to null and the caller falls through to the next tier.
 */
export async function fetchJson<T>(url: string, init?: RequestInit, timeoutMs = 10000) {
  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        'user-agent': userAgent,
        accept: 'application/json',
        ...(init?.headers ?? {}),
      },
      signal: AbortSignal.timeout(timeoutMs),
      next: { revalidate: 0 },
    });

    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}
