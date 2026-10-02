# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
EventHub is a full-stack event ticket booking platform built for QA training. Users register/log in, browse events, book tickets, manage bookings, and create their own events. Each user operates in an isolated sandbox (see Key Business Rules below).

## Tech Stack
- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, React Query v5, Axios
- **Backend**: Express.js, Prisma ORM, MySQL 8+
- **Auth**: JWT (7-day expiry, `Bearer` header), bcryptjs password hashing
- **Testing**: Playwright E2E (Chromium only)

## Commands
```bash
npm run setup        # Install deps in both /backend and /frontend
npm run dev           # Start frontend (3000) + backend (3001) concurrently
npm run db:push       # Push Prisma schema to DB (non-interactive)
npm run migrate       # prisma migrate dev (interactive, creates migration files)
npm run seed          # Seed 10 static events
npm run build          # Build the Next.js frontend
npm run lint           # Lint the frontend (next lint)
npm run test           # Run all Playwright tests
npm run test:ui        # Playwright UI mode
npm run test:report    # Open last HTML report
npx playwright test tests/<file>.spec.js --reporter=line   # Run a single test file
```
Backend-only: `npx prisma studio`, `npx prisma generate` (run from `backend/`).

## IMPORTANT: Playwright tests target the live deployed site, not local dev
`playwright.config.ts` sets `baseURL: 'https://eventhub.rahulshettyacademy.com'`, and all specs in `tests/` hardcode that same URL rather than reading `baseURL`. Running `npm run test` does **not** exercise your local `npm run dev` servers — it hits the deployed production-like instance. Keep this in mind when a test failure doesn't reproduce locally, or when a backend/frontend change needs to be deployed before a test can validate it.

## Project Structure
```
eventhub/
├── frontend/          # Next.js 14 app (port 3000)
│   ├── app/            # Pages (App Router): /, /login, /register, /events, /events/[id],
│   │                   #   /bookings, /bookings/[id], /admin/events, /admin/bookings
│   ├── components/     # ui/ primitives, events/, bookings/, layout/, auth/ (AuthGuard)
│   ├── lib/             # api/ (axios client + interceptors), hooks/ (useAuth, useEvents, useBookings), providers.jsx
│   └── types/           # Shared TypeScript interfaces
├── backend/            # Express API (port 3001)
│   ├── src/
│   │   ├── routes/        # HTTP endpoints (auth, events, bookings)
│   │   ├── controllers/   # Thin HTTP layer
│   │   ├── services/      # Business logic, validation, transactions
│   │   ├── repositories/  # Prisma data access
│   │   ├── validators/    # express-validator middleware
│   │   └── middleware/     # authMiddleware (JWT verify), errorHandler, requestLogger
│   └── prisma/             # schema.prisma (User/Event/Booking) + seed.js
├── tests/              # Playwright E2E specs, run against the deployed site (see above)
├── .claude/skills/      # Domain knowledge + agent skills (see below)
└── playwright.config.ts
```

## Architecture Pattern
Backend follows layered architecture: **Routes → Controllers → Services → Repositories → Prisma/MySQL**. Auth is enforced by `authMiddleware` (verifies the `Bearer` JWT and sets `req.user`); events and bookings endpoints require it, auth endpoints (`/api/auth/register`, `/login`, `/me`) don't. The frontend's axios client (`frontend/lib/api/client.js`) attaches the JWT from `localStorage` on every request and force-redirects to `/login` on a 401 response.

Swagger UI is served at `/api/docs` from JSDoc comments in the route files.

## Key Business Rules
- Max 6 user-created events per account (FIFO: oldest auto-deleted on overflow); static (seeded) events don't count and can't be edited/deleted
- Max 9 bookings per user (FIFO: oldest auto-deleted on overflow)
- Booking ref format `[FIRST_LETTER]-[6_RANDOM_ALPHANUMERIC]`, where the first character is the event title's first letter, uppercased
- Seat count reduces on booking, restores on cancellation; for dynamic events, available seats are computed per-user (`totalSeats - sum of that user's booking quantities`), so the same user can book the same event repeatedly for testing
- Refund eligibility is **client-side only** (no backend endpoint): 1 ticket = eligible, >1 ticket = not eligible, shown after a 4s spinner
- Cross-user booking access returns 403 "Access Denied"
- Deleting a user cascades to their events and bookings

Full detail (data models, error codes, UI selectors, user flows) lives in `.claude/skills/eventhub-domain/` — read `business-rules.md`, `api-reference.md`, `ui-selectors.md`, `user-flows.md` as needed.

## Testing Conventions
- Test files go in `tests/` as `<feature-name>.spec.js`, self-contained (login → action → assert)
- Follow `.claude/skills/playwright-best-practices/SKILL.md`
- Locator priority: `data-testid` > role > label/placeholder > ID > CSS class (see `data-testid` reference in README.md)
- No `page.waitForTimeout()` — use `expect().toBeVisible()`
- Test account: `rahulshetty1@gmail.com` / `Magiclife1!`

## CI/CD
- `.github/workflows/ci.yml` — PR gate: backend syntax/Prisma validation, frontend `tsc --noEmit` + production build, and a schema-drift check that SSHes into the production server to diff the PR's `schema.prisma` against the live DB (read-only)
- `.github/workflows/playwright.yml` — runs the full Playwright suite against the live site on every push to `main`, uploads the HTML report as an artifact
- `.github/workflows/deploy.yml` — deployment, gated by `ci.yml` via `workflow_call`

## Custom Skills/Agents (`.claude/skills/`)
Invoked as slash commands; each reads `eventhub-domain` and/or `playwright-best-practices` first:
- `/generate-tests <feature>` — writes Playwright tests, validates against a real browser, self-healing debug loop
- `/review-tests <file>` — reviews test code quality against the best-practices standard
- `/create-scenarios <area>` — generates functional test scenarios from domain knowledge
- `/test-strategy <scenarios>` — assigns test-pyramid layers (Unit/API/Component/E2E) to scenarios

## Code Style
- Backend: JavaScript with JSDoc, Express patterns
- Frontend: TypeScript, React hooks, Tailwind utility classes
- Tests: JavaScript with Playwright test runner
- Use meaningful variable names, add step comments in tests
- Keep functions focused and single-responsibility
