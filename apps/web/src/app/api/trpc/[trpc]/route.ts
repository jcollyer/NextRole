import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import type { NextRequest } from 'next/server';

import { appRouter, createTRPCContext, type SessionLike } from '@saas/api';
import { auth } from '@/server/auth';

async function resolveSession(): Promise<SessionLike | null> {
  const cookieSession = await auth();
  if (cookieSession?.user?.id) {
    return {
      user: {
        id: cookieSession.user.id,
        email: cookieSession.user.email,
        name: cookieSession.user.name,
        image: cookieSession.user.image,
      },
      expires: cookieSession.expires,
    };
  }

  return null;
}

const handler = async (req: NextRequest) => {
  const session = await resolveSession();

  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ session, headers: req.headers }),
    onError({ error, path }) {
      if (process.env.NODE_ENV === 'development') {
        console.error(`tRPC error on ${path ?? '<unknown>'}:`, error);
      }
    },
  });
};

export { handler as GET, handler as POST };
