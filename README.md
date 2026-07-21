# NextRole

NextRole is a personal job-search CRM for tracking target companies, discovering roles, scoring fit, and keeping application follow-ups visible.

## Current MVP

- Auth.js / NextAuth with Google SSO and optional Resend magic links.
- Protected web app routes under `/dashboard`, `/companies`, `/jobs`, `/applications`, `/follow-ups`, `/signals`, `/import`, and `/settings`.
- Prisma models for companies, jobs, applications, scan history, and hiring signals.
- Company CRUD with priority, status, category, remote policy, careers URL, and notes.
- CSV company import with client-side parsing, validation, preview, and duplicate-aware import.
- Manual job entry plus a first-pass role analysis button.
- Manual careers-page scans that detect likely role links and store new jobs.
- Application and follow-up tracking.
- Manual funding and hiring signal tracking.

## Tech Stack

- Turborepo monorepo with npm workspaces.
- Next.js App Router, React, TypeScript, Tailwind CSS, shadcn-style UI primitives.
- Auth.js with Prisma adapter and database sessions.
- PostgreSQL and Prisma.
- tRPC package scaffold retained for future typed API expansion.

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure `.env`:

   - `DATABASE_URL` / `DIRECT_URL`
   - `AUTH_SECRET`
   - `AUTH_URL`, for example `http://localhost:3000`
   - `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`
   - Optional: `AUTH_RESEND_KEY` / `EMAIL_FROM`

3. Apply the database schema:

   ```bash
   npm run db:migrate
   ```

   For quick local iteration, `npm run db:push` also works.

4. Run the web app:

   ```bash
   npm run dev
   ```

## Common Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the Next.js web app |
| `npm run build` | Build the web app and shared packages via Turbo |
| `npm run typecheck` | Typecheck every workspace |
| `npm run db:migrate` | Create/apply a Prisma migration |
| `npm run db:push` | Push schema changes directly |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:seed` | Seed a demo user |

## Notes

The workspace package scope is still `@saas/*` from the original scaffold. That can be renamed later as a mechanical follow-up once the product surface settles.
