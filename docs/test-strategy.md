# EventHub — Booking Management Test Strategy

Generated: 2026-08-24
Input: `docs/test-scenarios.md` (105 scenarios, TC-001 → TC-520)
Scope: Booking Management — create, view, cancel, clear, refund eligibility, `/admin/bookings`
Consumed by: `/generate-tests`

---

## 0. Tooling reality check (read this first)

The layer assignments below assume four runners. **Only one of them exists today.**

| Layer | Runner needed | Status | Action required |
|---|---|---|---|
| Unit | Vitest in `backend/` | ❌ Absent — `backend/package.json` has no `devDependencies` for testing | Add `vitest` |
| API | Playwright `request` fixture | ⚠️ Available but unused — `@playwright/test` is installed, no `tests/api/` exists | Create `tests/api/` |
| Component | Vitest + React Testing Library + jsdom in `frontend/` | ❌ Absent — `frontend/package.json` has no test deps | Add `vitest`, `@testing-library/react`, `@testing-library/user-event`, `jsdom`, `@vitejs/plugin-react` |
| E2E | Playwright | ✅ Installed | — |

`tests/` is currently **empty**. The only booking suite (`tests/booking-management.spec.js`, 6 tests, all E2E) exists at `HEAD` but is deleted in the working tree. Its anti-patterns are analysed in §7 because it is the baseline `/generate-tests` will otherwise imitate.

**Two structural constraints shape every decision below:**

1. **Playwright targets the deployed site.** `playwright.config.ts` sets `baseURL: 'https://eventhub.rahulshettyacademy.com'`. There is no local server, no test database, and no fixture seeding. Any scenario needing an exact DB precondition (exactly 9 bookings, a past `eventDate`, a row with `status: 'cancelled'`) either has to be built through the API at runtime or cannot run at that layer at all.
2. **The API layer must run over HTTP, not supertest.** Because the target is a deployed instance, use Playwright's `request` fixture (`tests/api/*.api.spec.js`) rather than `supertest` + an in-process app. Same runner, same reporter, same CI job — and it exercises the real middleware chain. Trade-off: tests share the live test account's state, so every API spec needs `DELETE /api/bookings` in `beforeEach`.

---

## 1. Distribution

| Layer | Count | % | Focus | Est. runtime |
|---|---:|---:|---|---|
| **Unit** | 12 | 11% | `randomRef` / `generateUniqueRef` purity; the `validateCreateBooking` express-validator chain in isolation | < 5 s |
| **API** | 46 | 44% | Service business rules (FIFO, seats, pricing), auth + ownership contracts, HTTP status/body shapes | ~3–4 min |
| **Component** | 33 | 31% | Render branches, UI state machines, client-only logic (refund, form validation, formatting) | ~30 s |
| **E2E** | 14 | 13% | Full-stack journeys, real-browser-only behaviour (native dialogs, XSS inertness, auth redirects) | ~3 min (4 workers) |
| **Total** | **105** | | | **~7 min** |

### Shape note — this is a diamond, not a pyramid, and that is correct here

A textbook pyramid wants the widest tier at Unit. EventHub cannot produce that honestly: `bookingService.js` is 140 lines and **every meaningful rule is a database interaction**, not a computation. FIFO pruning is three repository calls; seat availability is a `groupBy`; pricing is one multiplication. There are exactly two pure functions in the entire booking domain (`randomRef`, and the express-validator chain).

Manufacturing a wide unit tier would mean mocking `bookingRepository` so thoroughly that the tests assert the mock's shape rather than the rule. So the base is **Unit + API together = 58 of 105 (55%)**, both fast and both running without a browser. E2E is held to 13%, which is the number that actually matters.

§6 lists the six places where a *service-level* unit test with mocked repositories genuinely pays for itself as a second line of defence.

---

## 2. Unit layer — 12 scenarios

Target: `backend/tests/unit/`. Two subjects only.

### 2a. `randomRef` / `generateUniqueRef` — `backend/src/services/bookingService.js:11-32`

`randomRef(eventTitle)` is pure apart from `Math.random`; `generateUniqueRef` needs only `bookingRepository.findByRef` mocked.

| TC | Title | P | Justification |
|---|---|---|---|
| TC-102 | Ref first char = event title first char, uppercased | P0 | `prefix = (eventTitle?.[0] ?? 'E').toUpperCase()` — a one-line string operation. The old E2E spent ~25 s of browser time on this. Also kept at API (§6). |
| TC-405 | Collision retry, then timestamp fallback | P2 | The 10-attempt loop is *only* reachable by forcing `findByRef` to return a hit — impossible to provoke at any higher layer. Mock it and the branch is deterministic. |
| TC-408 | Digit-first title → `1-XXXXXX` | P2 | `toUpperCase()` on a digit. Pure. |
| TC-415 | Non-letter prefixes (leading space, emoji, `#`) | P2 | The emoji case asserts a UTF-16 code-unit slice — a string fact, not a system fact. The *ref-lookup* half of this scenario (URL-encoding a space) stays at API. |

### 2b. `validateCreateBooking` chain — `backend/src/validators/bookingValidator.js:15-44`

An express-validator chain is a plain array of middleware. Run it against a fake `req` and read `validationResult`. Boundary permutations cost ~1 ms each here vs. ~400 ms over HTTP.

| TC | Title | P | Justification |
|---|---|---|---|
| TC-115 | `customerEmail` is `normalizeEmail()`d | P1 | `.normalizeEmail()` on line 30 — a library transform. Assert `First.Last+tag@GMail.com` → `firstlast@gmail.com`. Kept at API too (§6) because the surprise is user-visible. |
| TC-305 | `quantity` 0 / negative → invalid | P1 | `isInt({min:1,max:10})` |
| TC-306 | `quantity` > 10 → invalid | P1 | same rule, upper bound |
| TC-314 | Digit-free phone (`----------`) **passes** backend validation | P1 | The defect is that `.isLength({min:10})` + `/^[0-9+\-\s()]+$/` never require a digit. Provable in 3 assertions against the chain. The UI half goes to Component. |
| TC-315 | `2.5` rejected; `"3"` coerced to `3` | P2 | `.toInt()` behaviour — read the sanitised value straight off the chain. |
| TC-316 | `eventId` `"abc"` / `0` / `-5` / `null` → invalid | P2 | `isInt({min:1})`, 4 permutations |
| TC-412 | `customerName` 1 char vs 2, and `"  A  "` | P1 | Asserts `.trim()` runs **before** `.isLength` — an ordering fact about the chain itself. |
| TC-413 | `customerPhone` 9 vs 10 chars, and `+91 98765 43210` | P1 | Character-count vs digit-count boundary; pairs with TC-314. |

> **Anti-pattern avoided:** every one of TC-305/306/315/316/412/413 was marked "API" in `test-scenarios.md`. Input validation over HTTP is the classic one-layer-too-high mistake. Two representative validation tests stay at API to prove the wire contract (TC-304, TC-318); the other six move down.

---

## 3. API layer — 46 scenarios

Target: `tests/api/`. Playwright `request` fixture, `Authorization: Bearer <jwt>` from `POST /api/auth/login`.

### 3a. Business rules — the FIFO / seat / pricing engine (16)

Every one of these is a `bookingService` rule that only exists once data is in MySQL.

| TC | Title | P | Source |
|---|---|---|---|
| TC-100 | 10th booking prunes oldest from a **different** event | P0 | `bookingService.js:73` `findOldestUserBookingExcludingEvent` |
| TC-101 | Same-event fallback burns a seat | P1 | `bookingService.js:95-97` `decrementSeats` |
| TC-106 | `totalPrice = price × quantity` | P0 | `bookingService.js:99` |
| TC-107 | Pagination envelope shape | P1 | `bookingService.js:43-51` |
| TC-108 | Cancel restores computed seats | P1 | `getBookedQuantitiesForEvents` drops the row's qty |
| TC-110 | Booking a static event never writes `availableSeats` | P0 | `eventService.js:6-18` `withPersonalSeats`. **Needs two accounts** — user B must see 500 while user A sees 497. Only provable at API. |
| TC-111 | Rebook same event until personal allotment exhausts | P1 | `bookingService.js:86-92` |
| TC-112 | Injected `status:'cancelled'` is ignored | P1 | `bookingService.js:113` hard-codes `'confirmed'` |
| TC-113 | `DELETE /api/events/:id` cascades to bookings | P0 | `schema.prisma` `onDelete: Cascade` |
| TC-114 | Deleting a user cascades to bookings | P2 | ⛔ **Blocked** — needs direct DB access, no API deletes a user. See §9. |
| TC-116 | 9-cap counts static + dynamic together | P1 | `countUserBookings` has no `isStatic` filter |
| TC-117 | Clear-all reports `N booking(s) cleared`, idempotent | P2 | `bookingController.js:43` |
| TC-400 | FIFO prefers a different event | P0 | *Near-duplicate of TC-100 — see §8* |
| TC-401 | Same-event fallback burns seat | P1 | *Duplicate of TC-101 — see §8* |
| TC-403 | `quantity: 10` → 201, `totalPrice × 10` | P1 | Upper boundary of a *successful* create. The "+ button disabled" half → Component. |
| TC-418 | No prune when cascade already dropped the count to 8 | P2 | `count >= MAX_USER_BOOKINGS` re-reads live (`bookingService.js:70`) |

### 3b. Auth, ownership, and injection contracts (12)

| TC | Title | P | Source |
|---|---|---|---|
| TC-201 | Cross-user GET → 403 | P0 | `bookingService.js:57` `ForbiddenError` |
| TC-202 | Cross-user DELETE → **404, not 403** | P0 | `bookingService.js:127` — `findById(id,userId)` scopes by user, so line 129's `ForbiddenError` is unreachable dead code |
| TC-203 | `GET /api/bookings` unauth → 401 | P0 | `bookingRoutes.js:8` `router.use(authMiddleware)` |
| TC-204 | `GET /api/bookings/:id` unauth → 401 | P0 | same |
| TC-205 | `DELETE /api/bookings` unauth → 401 | P0 | same |
| TC-206 | Cross-user ref lookup → 403 | P1 | `bookingService.js:64` |
| TC-207 | Tampered JWT → 401 `Invalid or expired token` | P0 | `authMiddleware.js:12` — distinct from the missing-header `Unauthorized`. Browser force-logout half → E2E. |
| TC-208 | `Basic`/bare/lowercase `bearer` → 401 | P1 | `authMiddleware.js:6` case-sensitive `startsWith('Bearer ')` — 3 header permutations, zero UI |
| TC-209 | 403-on-read vs 404-on-delete leaks existence | P2 | 4-call differential matrix. Impossible to observe through the UI. |
| TC-211 | SQLi payloads in `:ref` → 404, no 500 | P2 | `findByRef` → Prisma `findUnique`, parameterised |
| TC-212 | Body `userId` cannot book for another user | P0 | `bookingController.js:33` passes `req.user.userId`; body `userId` isn't in the validator whitelist |
| TC-213 | Cannot book another user's dynamic event → 404 | P0 | `eventRepository.findById(id, userId)` scoping |

### 3c. Error contracts and unvalidated inputs (11)

| TC | Title | P | Source |
|---|---|---|---|
| TC-301 | Unknown id → 404 | P1 | `bookingService.js:56` |
| TC-302 | Insufficient seats → 400 | P0 | `InsufficientSeatsError`, `bookingService.js:88-92` |
| TC-303 | Unknown event → 404 | P1 | `bookingService.js:83` |
| TC-304 | Missing required fields → 400 | P1 | **Wire-contract representative** for the validator (details in §2b) |
| TC-307 | Double cancel → 404 | P1 | `cancelBooking` re-reads before delete |
| **TC-310** | **Failed booking still destroys the oldest booking** | **P0** | `bookingService.js:70-79` prune runs **before** the event lookup (`:82`) and seat check (`:86`), with no transaction. Highest-value test in the suite. |
| TC-311 | `GET /api/bookings/abc` → 500, no stack leak | P1 | `Number('abc')` → `NaN` → Prisma throws; route has no `isInt` param validator. Assert `errorHandler.js` fallback doesn't leak internals. |
| TC-312 | Unknown ref → 404 | P2 | `bookingService.js:63` |
| TC-313 | `page=0` → 1; `page=-3` → negative `skip` → 500 | P2 | `bookingRepository.js:8` unvalidated arithmetic |
| TC-318 | Empty body → all 5 field errors at once | P2 | **Wire-contract representative** — asserts the `details: [{field, message}]` shape from `bookingValidator.js:9` |
| TC-416 | 300-char name → 500 from `VARCHAR(191)` | P3 | No max-length validator; assert no Prisma text in the body |

### 3d. Query, pagination, and data shape (7)

| TC | Title | P | Source |
|---|---|---|---|
| TC-007 | `GET /api/bookings/ref/:ref` → 200 + nested event | P1 | `bookingRoutes.js:196` |
| TC-013 | Newest-first ordering | P2 | `bookingRepository.js:19` `orderBy: { createdAt: 'desc' }` |
| TC-406 | Clear-all with one booking → `deleted: 1` | P2 | `deleteAllForUser` count |
| TC-407 | `?page=2&limit=5` partial page | P2 | `bookingService.js:38-49` |
| TC-410 | 9-cap ⇒ `totalPages` is always 1 at `limit=10` | P2 | Rule 4 vs `bookings/page.tsx:24` |
| TC-411 | `limit=1000` honoured despite Swagger `maximum: 100` | P3 | `bookingService.js:39` `Number(limit) \|\| 10`, no clamp — a doc-vs-impl divergence, invisible to the UI |
| TC-514 | `status=cancelled` filter can never return rows | P2 | `STATUS_OPTIONS` (`admin/bookings/page.tsx:14`) vs hard-coded `'confirmed'`. One API call proves the option is dead; the empty-state render is Component. |

---

## 4. Component layer — 33 scenarios

Target: `frontend/tests/component/`, Vitest + RTL + jsdom. Mock `next/navigation`, wrap in `QueryClientProvider`, stub the axios layer.

### 4a. Client-only business logic (5) — no backend exists for these

`RefundEligibility` (`frontend/app/bookings/[id]/page.tsx:21-71`) is entirely frontend: `setTimeout(… , 4000)` then `quantity === 1 ? 'eligible' : 'ineligible'`. There is no refund endpoint. Testing it through a browser costs **4 real seconds per case**; with fake timers it costs ~5 ms.

| TC | Title | P | Justification |
|---|---|---|---|
| TC-103 | q=1 → eligible (green) | P0 | Also kept at E2E (§6) — signature rule |
| TC-104 | q>1 → not eligible, quantity interpolated | P0 | `{quantity} tickets` in the message string |
| TC-105 | Spinner visible, result after ~4 s | P1 | `vi.useFakeTimers()` + `advanceTimersByTime(4000)`. Asserting a timing constant in a real browser is a flake generator. |
| TC-404 | q=2 boundary → not eligible | P1 | First ineligible value |
| TC-419 | Unmount during the pending 4 s timeout | P3 | `check()` has no cleanup. RTL surfaces the state-update-after-unmount warning directly; in a browser you'd be scraping console output. |

### 4b. Form logic — `BookingForm` (`frontend/app/events/[id]/page.tsx`) (4)

| TC | Title | P | Justification |
|---|---|---|---|
| TC-309 | Invalid name/email/phone blocks submit, **no POST** | P1 | `validate()` at `:92`, form is `noValidate` (`:113`). Asserting "no request was sent" is trivial against a mocked API module. |
| TC-409 | `+` disabled at `availableSeats` when < 10 | P1 | `maxQty = Math.min(10, event.availableSeats)` (`:81`), `disabled={form.quantity >= maxQty}` (`:129`), `(max {maxQty})` label (`:131`) — three props of one component. |
| TC-511 | Sold out → button reads "Sold Out", disabled | P1 | `soldOut = availableSeats === 0` (`:83`), `:152-153` |
| TC-314 (UI half) | UI rejects the phone the API accepts | P1 | `form.customerPhone.replace(/\D/g,'').length < 10` (`:92`). Paired with the Unit half, the divergence is proven by two sub-second tests. |

### 4c. Render branches of `BookingsContent` / `BookingDetailPage` (12)

Every one of these is a `?:` or `&&` branch driven by one piece of state.

| TC | Title | P | Source |
|---|---|---|---|
| TC-300 | "Booking not found" on 404 | P1 | `[id]/page.tsx:131-141` |
| TC-308 | "Couldn't load bookings" + Retry | P2 | `bookings/page.tsx:72-78` |
| TC-500 | Exactly 5 skeletons while loading | P1 | `bookings/page.tsx:66-70` — asserting the literal count 5 needs a held-open loading state, awkward to force in a browser |
| TC-501 | "No bookings yet" empty state | P1 | `bookings/page.tsx:80-92` |
| TC-502 | Detail-page `Spinner size="lg"` | P2 | `[id]/page.tsx:114-116` |
| TC-505 | Breadcrumb shows the ref | P2 | `[id]/page.tsx:147-151` |
| TC-507 | "Clearing…" + disabled during request | P2 | `clearing` state, `bookings/page.tsx:55-61` |
| TC-508 | Idle → checking → result; button gone | P2 | `RefundEligibility` state machine |
| TC-509 | 403 → "Access Denied", not "Booking not found" | P0 | `is403 = error?.status === 403` (`[id]/page.tsx:119`). The *branch* is component-level; the real cross-user 403 stays at E2E as TC-200. |
| TC-513 | Clear-all control still shown at zero bookings | P2 | Header at `bookings/page.tsx:54-63` sits outside all three branches |
| TC-516 | "1 ticket" vs "3 tickets" | P3 | `BookingCard.jsx:66` |
| TC-518 | Null `event` relation → "Event Booking" / "—" | P3 | `booking.event?.title ?? 'Event Booking'` (`[id]/page.tsx:164`). **Only testable here** — no API path returns a booking with a null event. |

### 4d. Dialogs, tables, and formatting (12)

| TC | Title | P | Source |
|---|---|---|---|
| TC-005 | "← Back to My Bookings" targets `/bookings` | P2 | `[id]/page.tsx:209-211` — a `Link href`. Asserting an attribute does not need a browser. |
| TC-010 | Admin table renders 8 columns, one row per booking | P1 | `admin/bookings/page.tsx` — pure data→table mapping from a stubbed array |
| TC-011 | Admin View modal fields | P2 | `BookingModal`, `admin/bookings/page.tsx:26-55` — presentational, takes a booking prop |
| TC-109 | Clear-all link present with **and** without bookings | P2 | Two renders, one component; *overlaps TC-513, see §8* |
| TC-317 | Stale cancel → 404 → error toast, dialog closes | P2 | `BookingCard.handleCancel` `onError` (`BookingCard.jsx:38`). "Two browser tabs" is just a way to manufacture a 404 — mock the rejection instead. |
| TC-414 | `299.97` renders as `$300` | P2 | `fmt_price` uses `maximumFractionDigits: 0` (`BookingCard.jsx:11`). Pure formatting. |
| TC-417 | Past-dated event renders with no "expired" badge | P3 | Stub `eventDate` in the past. The alternative — mutating a DB row — is why this sat at E2E. |
| TC-503 | Confirm dialog title/description/buttons | P0 | `ConfirmDialog` props from `BookingCard.jsx:90-98` |
| TC-504 | Dismissing the dialog issues no request | P1 | `onClose` sets `confirm=false`; assert the mutation mock was never called |
| TC-510 | Pagination renders when `totalPages > 1` | P2 | **Only testable here.** TC-410 proves the 9-booking cap makes `totalPages > 1` unreachable through the real UI at `limit: 10`. Stubbing the pagination object is the sole route to this branch. |
| TC-515 | "N total bookings" from `pagination.total` | P3 | `admin/bookings/page.tsx:98` |
| TC-517 | `status: 'cancelled'` → danger badge, Cancel hidden | P3 | **Only testable here.** TC-112 establishes no API path ever produces this row. Stub the prop or the branch is untestable. |
| TC-520 | Dialog locked while request in flight | P2 | `ConfirmDialog.jsx:16-25` — `onClose={!isLoading ? onClose : undefined}` |

---

## 5. E2E layer — 14 scenarios

Target: `tests/*.spec.js`. Held to 13% — these are the ones that fail if you test them anywhere else.

### 5a. Core journeys (8) — full-stack, multi-page

| TC | Title | P | Why it stays |
|---|---|---|---|
| TC-001 | Booking card renders on `/bookings` | P0 | The list→card→data round trip |
| TC-002 | Detail page shows all sections | P0 | List → detail navigation with real data |
| TC-003 | Cancel from detail → toast → redirect → gone | P0 | *Absorbs TC-506, see §8* |
| TC-004 | Clear all → empty state | P0 | Full-stack destructive action |
| TC-006 | "View My Bookings" after confirmation | P1 | Flow 3 → Flow 4 hand-off; two pages |
| TC-008 | Confirmation card: ref, customer, qty, total | P0 | Terminal assertion of the create journey |
| TC-009 | Cancel from the list card **stays** on `/bookings` | P0 | The behavioural contrast with TC-003 (no redirect) only exists across a real router |
| TC-012 | Admin row cancel → count decrements | P1 | Table → mutation → refetch → header count |

### 5b. Real-browser-only behaviour (6)

| TC | Title | P | Why no lower layer works |
|---|---|---|---|
| TC-200 | Cross-user `/bookings/:id` → "Access Denied" | P0 | Needs two real sessions and a real 403 in flight. TC-509 covers the render branch; this covers the wiring. |
| TC-210 | XSS payload renders inert on 4 surfaces | P1 | "No dialog fires, no element injected" is a claim about a real DOM with a real script engine. jsdom is not a sufficient oracle. |
| TC-402 | quantity=1 minimum — full booking path | P1 | The canonical create journey. Its boundary sibling TC-403 is at API. |
| TC-506 | Cancel toast + redirect | P0 | *Merged into TC-003, see §8* |
| TC-512 | Native `window.confirm`, dismiss aborts | P1 | `handleClearAll` uses `confirm()` (`bookings/page.tsx:28`), not `ConfirmDialog`. jsdom stubs `confirm` — which would test the stub. Needs `page.on('dialog', …)`. |
| TC-519 | Unauthed `/bookings` → `router.replace('/login')` | P0 | `AuthGuard` + `localStorage` + history semantics ("Back must not return") |

---

## 6. Defense-in-depth — rules covered at two layers

The skill's rule is that critical rules earn a second layer. Six do, plus a recommended service-unit tier.

| Rule | Primary | Second layer | Why both |
|---|---|---|---|
| Ref prefix (Rule 7) | Unit TC-102 | API TC-102 | Unit proves the string op; API proves the *event title* actually reaches `generateUniqueRef` with the right value — a wiring fact the unit test mocks away |
| `totalPrice = price × qty` (Rule 9) | API TC-106 | E2E TC-008 | API proves the stored decimal; E2E proves the displayed figure. TC-414 shows these disagree (`299.97` → `$300`) |
| Refund eligibility (Rule 8) | Component TC-103/104 | E2E TC-103 | Signature rule of the app; one E2E confirms the 4 s + result actually renders in a browser, the rest run on fake timers |
| Email normalisation | Unit TC-115 | API TC-115 | Unit proves the transform; API proves the *stored* value differs from the typed one — the part that surprises users |
| Cross-user 403 | API TC-201 | E2E TC-200 + Component TC-509 | Contract, wiring, and render branch are three separable failures |
| Validation contract | Unit (6 TCs) | API TC-304 + TC-318 | Unit covers permutations; API pins the `{field, message}` envelope |

### Recommended service-unit tier (widens the base without faking value)

Six API scenarios have branch logic worth pinning with mocked repositories in `backend/tests/unit/bookingService.test.js` — sub-millisecond, and they isolate *ordering* rather than outcome:

- **TC-310** — assert `bookingRepository.delete` is called **before** `eventRepository.findById`. This is the defect in one assertion, no database needed.
- **TC-100 / TC-101** — assert which finder is consulted first and whether `decrementSeats` fires (`sameEventFallback`)
- **TC-116** — assert `countUserBookings` is called with no `isStatic` filter
- **TC-418** — assert no prune when `count` returns 8
- **TC-106** — assert `parseFloat(price) * quantity` for decimal prices

---

## 7. Anti-patterns in the existing suite

Analysed from `tests/booking-management.spec.js` at `HEAD` (6 tests: TC-001, TC-002, TC-006, TC-102, TC-003, TC-004).

### Structural

1. **100% E2E — a single-scoop ice cream cone.** Six tests, all browser-driven, zero API and zero unit. The suite's entire assertion surface is what a browser can see.
2. **Zero coverage of every P0 defect.** TC-310 (a failed booking permanently destroys the user's oldest booking), TC-212, TC-213, TC-202 — none tested. The suite covers the happy path and nothing that would lose data.
3. **UI-driven setup in every test.** `login()` → `clearBookings()` → `bookEvent()` runs before all six tests: 3+ page loads, a form fill, and a dialog per test. Booking creation is a `POST /api/bookings` away. This one change removes the majority of the suite's runtime.

### Locator quality — violates the `data-testid` > role > label priority

4. **`page.locator('span.font-mono.font-bold').first()`** (TC-002 breadcrumb) — a three-Tailwind-class structural selector plus a positional `.first()`. Any styling change breaks it silently. The breadcrumb has no `data-testid`; add one.
5. **`.confirm-booking-btn`, `.booking-ref`, `firstCard.locator('h3')`** — CSS classes and tag names where `#confirm-booking` (an ID that exists, `events/[id]/page.tsx:152`) and testids are available.

### Assertion integrity

6. **`isVisible().catch(() => false)` as a conditional** (`clearBookings`). `isVisible()` does not retry, so it races the loading skeleton — on a slow load it returns `false` and the helper proceeds down the wrong branch. The `.catch()` swallows the evidence.
7. **Conditional branching inside a helper the tests depend on.** `clearBookings` does one thing or nothing depending on page state, so a test can pass having exercised neither path.
8. **`console.log` used as reporting.** Booking refs and titles are logged, not attached. On CI failure the log is disconnected from the report.
9. **Non-deterministic fixtures.** `bookEvent()` books "the first card with a Book Now button" — the event under test changes between runs, so no test can assert an exact price, seat count, or ref prefix without first reading it back from the page it is meant to be verifying.
10. **`BASE_URL` hardcoded instead of `baseURL` from config.** Already noted in `CLAUDE.md`; it means config-level overrides and `--project` targeting silently do nothing. All 14 E2E specs should read `baseURL`.

### Layer misplacement

11. **TC-102 (ref prefix) at E2E.** Pure string logic — `eventTitle[0].toUpperCase()` — costing a login, an event browse, a form fill, and a booking. → Unit (§2a).
12. **TC-002 asserting individual field rendering.** Section headings and field values are `BookingDetailPage` render output. The *journey* is E2E; the *fields* are Component (TC-518).

---

## 8. Redundant scenarios — merge before generating

`docs/test-scenarios.md` accumulated overlaps across three revisions. Generating from it as-is produces duplicate tests.

| Keep | Drop / merge | Note |
|---|---|---|
| TC-100 (API) | TC-400 | Both assert FIFO prunes the oldest booking from a different event. TC-400 adds nothing. |
| TC-101 (API) | TC-401 | Verbatim duplicates — same `sameEventFallback` path, same seat-burn assertion. |
| TC-003 (E2E) | TC-506 | TC-003 step 4 already asserts the toast and redirect that TC-506 restates. |
| TC-109 (Component) | TC-513 | Same unconditional header. TC-513's extra value is the `DELETE` returning `0 booking(s) cleared` — that assertion belongs to TC-117 (API). |
| TC-107 (API) | — | Overlaps TC-410; keep both — TC-107 pins the envelope shape, TC-410 pins the cap interaction. |
| TC-200 (E2E) / TC-509 (Component) | — | Deliberately split by layer, not redundant. |

Net after merging: **101 tests** (4 dropped).

---

## 9. Blocked scenarios and coverage risks

**⛔ Cannot run at the assigned layer without new infrastructure:**

- **TC-114** (user-delete cascade) — no API endpoint deletes a user, and Playwright has no DB connection. Requires either a Prisma-backed integration harness against a local test DB, or demotion to a manual/documented check. Do not let `/generate-tests` emit a fake pass for this.

**⚠️ Shared-state hazards on the deployed target:**

- Every FIFO scenario (TC-100/101/116/310/418) needs the account at **exactly 9 bookings**. Since all specs share `rahulshetty1@gmail.com`, parallel workers will corrupt each other's preconditions. Either run the FIFO specs `test.describe.serial` with a `DELETE /api/bookings` + 9 seeded bookings in `beforeEach`, or give them a dedicated account.
- TC-110, TC-200, TC-201, TC-202, TC-206, TC-209, TC-212, TC-213 need a **second account** (`rahulshetty1@yahoo.com` per TC-200). Confirm it exists before generating.
- TC-101/TC-401 **permanently burn a seat** on the target event via `decrementSeats`. Repeated CI runs monotonically drain that event. Use a freshly created dynamic event per run, never a static one.

**📉 Scenarios documenting defects, not desired behaviour** — assert the *actual* behaviour and mark them, so a future fix shows up as a red test rather than a silent behaviour change: TC-310 (P0 data loss), TC-202/TC-209 (403/404 inconsistency), TC-311, TC-313, TC-314, TC-411, TC-416, TC-514, TC-419.

---

## 10. Build order

1. **Unit — validators + `randomRef`** (12 tests). No infrastructure beyond `vitest` in `backend/`. Fastest feedback, removes 6 misplaced API scenarios.
2. **API — P0 security and the FIFO defect** (TC-310, TC-212, TC-213, TC-202, TC-201, TC-110, TC-113). Highest risk, zero current coverage, runs on already-installed Playwright.
3. **E2E — the 8 core journeys**, rebuilt with API-driven setup and `baseURL` from config. Replaces the deleted suite at roughly a third of its runtime.
4. **Component — refund + form + render branches** (33 tests). Largest tooling lift (`vitest` + RTL + jsdom in `frontend/`); also where the 4-second refund waits stop costing real time.
5. **API — remaining contracts** (the rest of §3).
6. **Service-unit tier** (§6) once the API tests have pinned the expected behaviour.
