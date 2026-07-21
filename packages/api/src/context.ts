import { prisma, PrismaClient } from '@saas/db';

/**
 * Minimal session shape the API expects from the Next.js web app. Keeping this
 * loose lets us evolve Auth.js without retyping the API.
 */
export interface SessionLike {
  user?: {
    id: string;
    email?: string | null;
    name?: string | null;
    image?: string | null;
  } | null;
  expires?: string;
}

export interface CreateContextOptions {
  session: SessionLike | null;
  headers?: Headers;
}

export function createTRPCContext(opts: CreateContextOptions): {
  session: SessionLike | null;
  headers: Headers | undefined;
  prisma: PrismaClient;
} {
  return {
    session: opts.session,
    headers: opts.headers,
    prisma,
  };
}

export type Context = ReturnType<typeof createTRPCContext>;
