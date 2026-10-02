# EventHub — Booking Management Test Scenarios

Generated: 2026-03-06
Updated: 2026-07-28 — added booking-creation form scenarios (seat-capped quantity, sold-out state, client-side validation)
Updated: 2026-08-20 — added admin bookings page, cascade, auth-token, injection, validation-divergence, and FIFO-ordering-bug scenarios; corrected TC-109 and TC-202 to match implementation
Scope: Booking Management (Flow 3 — Create; Flow 4 — View, Cancel, Clear, Refund Eligibility; `/admin/bookings` management table)

---

## Happy Path

### TC-001: View bookings list with existing bookings
**Category**: Happy Path
**Priority**: P0
**Preconditions**: User is logged in; user has at least one confirmed booking
**Steps**:
1. Navigate to `/bookings`
2. Observe the list of booking cards rendered
**Expected Results**: Each booking card displays booking reference, event name, quantity, total price, and "View Details" link
**Business Rule**: Flow 4 — Manage Bookings
**Suggested Layer**: E2E

---

### TC-002: View single booking detail page
**Category**: Happy Path
**Priority**: P0
**Preconditions**: User is logged in; user has at least one confirmed booking
**Steps**:
1. Navigate to `/bookings`
2. Click "View Details" on any booking card
3. Observe the booking detail page at `/bookings/:id`
**Expected Results**: Page shows event details (title, date, venue, city, category), customer details (name, email, phone), payment summary (quantity, price per ticket, total paid), booking reference in breadcrumb and header, booking ID, and "Check eligibility for refund?" link
**Business Rule**: Booking model fields; Flow 4
**Suggested Layer**: E2E

---

### TC-003: Cancel a single booking from the detail page
**Category**: Happy Path
**Priority**: P0
**Preconditions**: User is logged in; user has at least one confirmed booking
**Steps**:
1. Navigate to `/bookings/:id`
2. Click "Cancel Booking" button
3. Confirm in the dialog by clicking "Yes, cancel it"
4. Observe redirect and bookings list
**Expected Results**: Success toast "Booking cancelled successfully" appears; user is redirected to `/bookings`; cancelled booking no longer appears in the list
**Business Rule**: Booking cancellation deletes the record; seats released for dynamic events
**Suggested Layer**: E2E

---

### TC-004: Clear all bookings from the bookings list page
**Category**: Happy Path
**Priority**: P0
**Preconditions**: User is logged in; user has at least one booking
**Steps**:
1. Navigate to `/bookings`
2. Click "Clear all bookings" link
3. Confirm the browser confirm dialog
4. Observe the page after clearing
**Expected Results**: All bookings are removed; page shows empty state "No bookings yet" with "Browse Events" button
**Business Rule**: `DELETE /api/bookings` clears all user bookings; `clearAllBookings` service method
**Suggested Layer**: E2E

---

### TC-005: Navigate back to bookings list from detail page
**Category**: Happy Path
**Priority**: P2
**Preconditions**: User is on a booking detail page
**Steps**:
1. Click "← Back to My Bookings" button at bottom of detail page
**Expected Results**: User is navigated to `/bookings`
**Business Rule**: UI navigation flow
**Suggested Layer**: E2E

---

### TC-006: Navigate to bookings via "View My Bookings" after completing a booking
**Category**: Happy Path
**Priority**: P1
**Preconditions**: User just completed a booking (confirmation card shown)
**Steps**:
1. After booking confirmation, click "View My Bookings" link
2. Observe the bookings page
**Expected Results**: User lands on `/bookings` and the newly created booking appears in the list
**Business Rule**: Flow 3 → Flow 4 navigation
**Suggested Layer**: E2E

---

### TC-007: Lookup booking by reference via API
**Category**: Happy Path
**Priority**: P1
**Preconditions**: User is authenticated; user has a booking with known `bookingRef`
**Steps**:
1. Send `GET /api/bookings/ref/:ref` with valid JWT and own booking ref
**Expected Results**: 200 response with full booking data including nested event
**Business Rule**: `GET /api/bookings/ref/:ref` endpoint
**Suggested Layer**: API

---

### TC-008: Booking confirmation card displays ref, customer, quantity, and total
**Category**: Happy Path
**Priority**: P0
**Preconditions**: User is logged in; event has available seats
**Steps**:
1. Navigate to `/events/:id`, fill out the booking form, and submit
2. Observe the in-page confirmation card (no navigation occurs on success)
**Expected Results**: Confirmation card shows "Booking Confirmed! 🎉", `.booking-ref` with the generated reference, customer name, ticket quantity, and total price (`fmt_price(totalPrice)`); "View My Bookings" and "Browse More Events" buttons are present
**Business Rule**: Flow 3 step 6; `BookingConfirmation` component in `frontend/app/events/[id]/page.tsx`
**Suggested Layer**: E2E

---

### TC-009: Cancel a booking directly from the bookings list card
**Category**: Happy Path
**Priority**: P0
**Preconditions**: User is logged in with at least two bookings
**Steps**:
1. Navigate to `/bookings`
2. Click "Cancel Booking" (`#cancel-booking-btn`) on one of the cards
3. Confirm with "Yes, cancel it" (`#confirm-dialog-yes`)
**Expected Results**: Toast "Booking cancelled successfully" appears; the card disappears from the list; the user REMAINS on `/bookings` (no redirect — unlike the detail page in TC-506); remaining bookings still render
**Business Rule**: `BookingCard.handleCancel` (`frontend/components/bookings/BookingCard.jsx:35-40`) — `onSuccess` only closes the dialog; the list refreshes via `invalidateQueries(['bookings'])`
**Suggested Layer**: E2E

---

### TC-010: Admin bookings page lists all bookings in a table
**Category**: Happy Path
**Priority**: P1
**Preconditions**: User is logged in with at least one booking
**Steps**:
1. Navigate to `/admin/bookings`
2. Observe the table
**Expected Results**: Table renders with columns Ref, Customer, Event, Qty, Total, Status, Date, Actions; one row per booking; each row shows the booking ref badge, customer name + email, event title, quantity, formatted total, status badge, booked date, and View/Cancel buttons
**Business Rule**: `AdminBookingsPage` (`frontend/app/admin/bookings/page.tsx`) — same `GET /api/bookings` data, `limit: 15`
**Suggested Layer**: E2E

---

### TC-011: Admin bookings — "View" opens the booking detail modal
**Category**: Happy Path
**Priority**: P2
**Preconditions**: User is on `/admin/bookings` with at least one booking
**Steps**:
1. Click "View" on a booking row
2. Observe the modal
**Expected Results**: Modal titled "Booking — {bookingRef}" opens showing Reference, Status badge, Event (title/date/city), Customer (name/email/phone), Tickets, Total, and Booked on; closing the modal returns to the table with no data change
**Business Rule**: `BookingModal` in `frontend/app/admin/bookings/page.tsx:26-55`
**Suggested Layer**: E2E / Component

---

### TC-012: Admin bookings — cancel a booking from the table row
**Category**: Happy Path
**Priority**: P1
**Preconditions**: User is on `/admin/bookings` with at least one confirmed booking
**Steps**:
1. Click "Cancel" on a row
2. Confirm "Yes, cancel it"
**Expected Results**: Toast "Booking cancelled" (note: different copy from the list page's "Booking cancelled successfully"); row disappears; the "N total bookings" count decreases by 1
**Business Rule**: `confirmCancel` in `frontend/app/admin/bookings/page.tsx:84-90`
**Suggested Layer**: E2E

---

### TC-013: Bookings are listed newest-first
**Category**: Happy Path
**Priority**: P2
**Preconditions**: User creates three bookings in a known order
**Steps**:
1. Create booking A, then B, then C
2. Send `GET /api/bookings` (and load `/bookings`)
**Expected Results**: Response order is C, B, A — descending `createdAt`; the UI renders the same order top-to-bottom
**Business Rule**: `bookingRepository.findAll` — `orderBy: { createdAt: 'desc' }`
**Suggested Layer**: API / E2E

---

## Business Rules

### TC-100: FIFO pruning — 10th booking replaces oldest booking from a different event
**Category**: Business Rule
**Priority**: P0
**Preconditions**: User has exactly 9 bookings (all for different events); user has JWT token
**Steps**:
1. Note the oldest booking ID
2. Create a new booking (10th) for a different event via `POST /api/bookings`
3. Retrieve all user bookings
**Expected Results**: Total booking count remains 9; the oldest booking is deleted; the new booking is present
**Business Rule**: Max 9 bookings per user; FIFO pruning prefers deleting from a different event
**Suggested Layer**: API

---

### TC-101: FIFO pruning — same-event fallback permanently burns a seat
**Category**: Business Rule
**Priority**: P1
**Preconditions**: User has exactly 9 bookings all for the SAME event; enough seats remain
**Steps**:
1. Create a 10th booking for the same event
2. Retrieve the event's available seats
**Expected Results**: Oldest booking is deleted; new booking is created; `availableSeats` decremented by the new booking's quantity (seat permanently burned via `decrementSeats`)
**Business Rule**: `sameEventFallback` path in `bookingService.createBooking`
**Suggested Layer**: API

---

### TC-102: Booking reference first character matches event title first character
**Category**: Business Rule
**Priority**: P0
**Preconditions**: User is logged in; event with known title exists (e.g., "Tech Conference Bangalore")
**Steps**:
1. Book the event
2. Read the `bookingRef` from the confirmation card or API response
**Expected Results**: `bookingRef` starts with the uppercase first character of the event title (e.g., "T-XXXXXX" for "Tech Conference")
**Business Rule**: `randomRef` function: prefix = `eventTitle[0].toUpperCase()`; Rule 7
**Suggested Layer**: E2E / API

---

### TC-103: Refund eligibility — single ticket booking is eligible
**Category**: Business Rule
**Priority**: P0
**Preconditions**: User has a booking with quantity = 1
**Steps**:
1. Navigate to `/bookings/:id` for the single-ticket booking
2. Click "Check eligibility for refund?"
3. Wait for spinner to disappear (4 seconds)
4. Read the refund result
**Expected Results**: `#refund-result` shows green "Eligible for refund. Single-ticket bookings qualify for a full refund."
**Business Rule**: Rule 8 — quantity === 1 → eligible
**Suggested Layer**: E2E

---

### TC-104: Refund eligibility — multi-ticket booking is NOT eligible
**Category**: Business Rule
**Priority**: P0
**Preconditions**: User has a booking with quantity > 1 (e.g., 3 tickets)
**Steps**:
1. Navigate to `/bookings/:id` for the multi-ticket booking
2. Click "Check eligibility for refund?"
3. Wait for spinner to disappear (4 seconds)
4. Read the refund result
**Expected Results**: `#refund-result` shows red "Not eligible for refund. Group bookings (3 tickets) are non-refundable." with correct quantity displayed
**Business Rule**: Rule 8 — quantity > 1 → not eligible
**Suggested Layer**: E2E

---

### TC-105: Refund eligibility spinner shows for approximately 4 seconds
**Category**: Business Rule
**Priority**: P1
**Preconditions**: User is on a booking detail page
**Steps**:
1. Click "Check eligibility for refund?"
2. Immediately check for spinner
3. Observe when spinner disappears and result appears
**Expected Results**: `#refund-spinner` is visible immediately after clicking; spinner disappears and `#refund-result` appears after ~4 seconds
**Business Rule**: Rule 8 — `setTimeout(..., 4000)` in `RefundEligibility` component
**Suggested Layer**: E2E / Component

---

### TC-106: Total price is calculated as price × quantity
**Category**: Business Rule
**Priority**: P0
**Preconditions**: User books an event with known price
**Steps**:
1. Book an event (e.g., price $1499, quantity 3)
2. View the booking detail page
**Expected Results**: "Total Paid" shows $4,497 (1499 × 3); `totalPrice` in API response equals `event.price × quantity`
**Business Rule**: Rule 9 — `totalPrice = event.price × quantity`
**Suggested Layer**: E2E / API

---

### TC-107: Bookings page shows max 10 bookings per page (pagination)
**Category**: Business Rule
**Priority**: P1
**Preconditions**: User has more than 10 bookings visible in DB (unlikely with limit 9, but relevant for API pagination param)
**Steps**:
1. Send `GET /api/bookings?page=1&limit=10`
**Expected Results**: Response includes `pagination.limit = 10`, `pagination.totalPages`, and `data` array with at most 10 items
**Business Rule**: Rule 4 — max 9 bookings per user; API default limit = 10
**Suggested Layer**: API

---

### TC-108: Cancelling a booking releases seat count for dynamic events (computed)
**Category**: Business Rule
**Priority**: P1
**Preconditions**: User has a dynamic (user-created) event with a booking
**Steps**:
1. Note the current available seats for the event (computed: totalSeats - booked quantities)
2. Cancel the booking for that event
3. Re-fetch the event detail
**Expected Results**: Available seats increase by the cancelled booking's quantity
**Business Rule**: Rule 6 — dynamic events compute seats as `totalSeats - sum(user's booking quantities)`; cancellation removes the booking record
**Suggested Layer**: API / E2E

---

### TC-109: Bookings list always shows the "Clear all bookings" control (header is unconditional)
**Category**: Business Rule
**Priority**: P2
**Preconditions**: User is logged in
**Steps**:
1. Navigate to `/bookings` with at least one booking — look for the "Clear all bookings" link
2. Clear all bookings so the list is empty — look for the link again
**Expected Results**: The link is visible in the top-right of the page header in BOTH states. It is rendered outside the `isLoading`/`isError`/`bookings.length === 0` branches, so it is present even in the empty state (see also TC-513)
**Business Rule**: Flow 4; header block in `BookingsContent` (`frontend/app/bookings/page.tsx:54-63`) is unconditional
**Suggested Layer**: E2E / Component

---

### TC-110: Booking a static event does NOT change the event's stored `availableSeats`
**Category**: Business Rule
**Priority**: P0
**Preconditions**: User is authenticated; a static (seeded) event exists, e.g. "Tech Conference Bangalore" with 500 seats
**Steps**:
1. Read the event's `availableSeats` as user A
2. Book 3 tickets for that event as user A
3. Re-read the event as user A, then read the same event as a different user B
**Expected Results**: For user A the reported `availableSeats` drops by 3 (497); for user B it is unchanged (500). The DB column is never written — `createBooking` only calls `decrementSeats` on the same-event FIFO fallback path (TC-101). The reduction users see is computed per-request
**Business Rule**: Rule 6 — `withPersonalSeats` (`backend/src/services/eventService.js:6-18`) returns `max(0, availableSeats - userBookedQty)`
**Suggested Layer**: API

---

### TC-111: Same user can book the same event repeatedly until their personal allotment is exhausted
**Category**: Business Rule
**Priority**: P1
**Preconditions**: User is authenticated; a dynamic event exists with `totalSeats = 5`
**Steps**:
1. Book 2 tickets, then 2 more tickets for the same event
2. Attempt to book 2 more (would total 6)
**Expected Results**: First two bookings succeed; personal available seats read 3, then 1; the third request fails with 400 "Only 1 seat(s) available, but 2 requested"
**Business Rule**: Rule 6 — per-user seat computation lets the same account rebook the same event for testing
**Suggested Layer**: API

---

### TC-112: Newly created bookings always have status "confirmed"
**Category**: Business Rule
**Priority**: P1
**Preconditions**: User is authenticated
**Steps**:
1. Create a booking with `status: "cancelled"` injected into the request body
2. Read the created booking
**Expected Results**: `status` is "confirmed" — the service hard-codes `status: 'confirmed'` and ignores any client-supplied value; no API path ever sets "cancelled" (cancellation deletes the row)
**Business Rule**: `bookingService.createBooking` sets `status: 'confirmed'`; Booking model default
**Suggested Layer**: API

---

### TC-113: Deleting an event cascades to delete its bookings
**Category**: Business Rule
**Priority**: P0
**Preconditions**: User owns a dynamic event with at least one booking against it
**Steps**:
1. Note the booking ID and ref
2. Send `DELETE /api/events/:eventId`
3. Send `GET /api/bookings` and `GET /api/bookings/:bookingId`; load `/bookings`
**Expected Results**: The booking is gone — list no longer contains it, detail returns 404, and the UI shows one fewer card (or the empty state). No orphan booking rows remain
**Business Rule**: `Booking.event` relation `onDelete: Cascade` (`backend/prisma/schema.prisma`)
**Suggested Layer**: API / E2E

---

### TC-114: Deleting a user cascades to their bookings
**Category**: Business Rule
**Priority**: P2
**Preconditions**: A disposable account exists with bookings; DB access available
**Steps**:
1. Create a throwaway user, create bookings for it
2. Delete the user row
3. Query bookings for that userId
**Expected Results**: Zero booking rows remain for that user; no FK violation is raised
**Business Rule**: Rule 2 — `Booking.user` relation `onDelete: Cascade`
**Suggested Layer**: API / Unit (DB-level)

---

### TC-115: `customerEmail` is normalized before storage
**Category**: Business Rule
**Priority**: P1
**Preconditions**: User is authenticated
**Steps**:
1. Create a booking with `customerEmail: "First.Last+tag@GMail.com"`
2. Read the booking back via API and on `/bookings/:id`
**Expected Results**: The stored/displayed email is the `normalizeEmail()` output (lowercased, Gmail dots and `+tag` stripped → `firstlast@gmail.com`) — NOT the string the user typed. Confirm the UI's "Email" field on the detail page reflects the normalized value, since this surprises users who expect their exact input
**Business Rule**: `validateCreateBooking` — `.normalizeEmail()` on `customerEmail` (`backend/src/validators/bookingValidator.js:26-30`)
**Suggested Layer**: API

---

### TC-116: The 9-booking cap counts static and dynamic event bookings together
**Category**: Business Rule
**Priority**: P1
**Preconditions**: User has 9 bookings — a mix of static (seeded) and user-created events
**Steps**:
1. Create a 10th booking
2. Count the user's bookings
**Expected Results**: Total stays at 9; the pruned booking is the oldest by `createdAt` regardless of whether its event was static or dynamic
**Business Rule**: Rule 4 — `countUserBookings` counts all rows for the user with no `isStatic` filter
**Suggested Layer**: API

---

### TC-117: Clear-all response reports the number of deleted bookings
**Category**: Business Rule
**Priority**: P2
**Preconditions**: User has exactly 4 bookings
**Steps**:
1. Send `DELETE /api/bookings`
**Expected Results**: HTTP 200 with message "4 booking(s) cleared"; a second immediate call returns "0 booking(s) cleared" (idempotent, still 200 — not 404)
**Business Rule**: `clearAllBookings` returns `deleted: result.count` from `deleteMany`
**Suggested Layer**: API

---

## Security

### TC-200: Cross-user booking access returns "Access Denied" (UI)
**Category**: Security
**Priority**: P0
**Preconditions**: Two test accounts exist (rahulshetty1@gmail.com and rahulshetty1@yahoo.com); User A has a booking
**Steps**:
1. Log in as User A, create a booking, note the booking ID
2. Log out (clear localStorage JWT)
3. Log in as User B
4. Navigate to `/bookings/:userA_booking_id`
**Expected Results**: Page shows "Access Denied" title and "You are not authorized to view this booking." description
**Business Rule**: Rule 2 — cross-user access returns 403; frontend renders "Access Denied" on 403 response
**Suggested Layer**: E2E

---

### TC-201: Cross-user booking access returns 403 via API
**Category**: Security
**Priority**: P0
**Preconditions**: User A has a booking; User B has a valid JWT
**Steps**:
1. Send `GET /api/bookings/:userA_booking_id` with User B's JWT
**Expected Results**: HTTP 403; response body contains "You are not authorized to view this booking"
**Business Rule**: `bookingService.getBookingById` — `booking.userId !== userId` → ForbiddenError
**Suggested Layer**: API

---

### TC-202: Cross-user booking cancellation is rejected with 404 (not 403)
**Category**: Security
**Priority**: P0
**Preconditions**: User A has a booking; User B has a valid JWT
**Steps**:
1. Send `DELETE /api/bookings/:userA_booking_id` with User B's JWT
2. Re-fetch the booking as User A
**Expected Results**: The delete is rejected and User A's booking still exists. The status code is **404** with "Booking with id X not found" — NOT 403: `cancelBooking` looks the booking up via `bookingRepository.findById(id, userId)`, which already scopes by `userId`, so a foreign booking resolves to `null` and throws `NotFoundError` first. The subsequent `booking.userId !== userId` → `ForbiddenError` line is unreachable dead code
**Business Rule**: `bookingService.cancelBooking` (`backend/src/services/bookingService.js:126-136`) vs. `getBookingById` which does return 403 — see TC-209 for the inconsistency
**Suggested Layer**: API

---

### TC-203: Unauthenticated access to bookings list returns 401
**Category**: Security
**Priority**: P0
**Preconditions**: No valid JWT
**Steps**:
1. Send `GET /api/bookings` without Authorization header
**Expected Results**: HTTP 401; "Unauthorized" error message
**Business Rule**: Auth middleware on all `/api/bookings` routes
**Suggested Layer**: API

---

### TC-204: Unauthenticated access to booking detail returns 401
**Category**: Security
**Priority**: P0
**Preconditions**: No valid JWT
**Steps**:
1. Send `GET /api/bookings/:id` without Authorization header
**Expected Results**: HTTP 401; "Unauthorized" error message
**Business Rule**: Auth middleware
**Suggested Layer**: API

---

### TC-205: Unauthenticated DELETE /api/bookings returns 401
**Category**: Security
**Priority**: P0
**Preconditions**: No valid JWT
**Steps**:
1. Send `DELETE /api/bookings` without Authorization header
**Expected Results**: HTTP 401
**Business Rule**: Auth middleware; `clearAllBookings` requires authenticated user
**Suggested Layer**: API

---

### TC-206: Cross-user booking lookup by ref returns 403
**Category**: Security
**Priority**: P1
**Preconditions**: User A has a booking with known ref; User B has a valid JWT
**Steps**:
1. Send `GET /api/bookings/ref/:userA_ref` with User B's JWT
**Expected Results**: HTTP 403; "You do not own this booking"
**Business Rule**: `bookingService.getBookingByRef` — ownership check
**Suggested Layer**: API

---

### TC-207: Tampered or expired JWT is rejected and the UI force-logs-out
**Category**: Security
**Priority**: P0
**Preconditions**: User has a valid session
**Steps**:
1. Send `GET /api/bookings` with a JWT whose signature has been altered by one character
2. In the browser, overwrite `localStorage.eventhub_token` with the tampered value and navigate to `/bookings`
**Expected Results**: API returns HTTP 401 "Invalid or expired token" (distinct from the missing-header "Unauthorized"). In the browser the axios response interceptor removes `eventhub_token` from `localStorage` and hard-redirects to `/login`; no booking data is rendered
**Business Rule**: `authMiddleware` catch branch; 401 handler in `frontend/lib/api/client.js:28-31`
**Suggested Layer**: API / E2E

---

### TC-208: Malformed Authorization header is rejected
**Category**: Security
**Priority**: P1
**Preconditions**: A valid token string is known
**Steps**:
1. Send `GET /api/bookings` with header `Authorization: <token>` (no "Bearer " prefix)
2. Repeat with `Authorization: Basic <token>` and with `Authorization: bearer <token>` (lowercase)
**Expected Results**: All three return HTTP 401 "Unauthorized" — the check is a case-sensitive `startsWith('Bearer ')`; no booking data leaks
**Business Rule**: `authMiddleware` (`backend/src/middleware/authMiddleware.js:5-8`)
**Suggested Layer**: API

---

### TC-209: Booking-ownership responses are inconsistent and leak existence (403 on read, 404 on delete)
**Category**: Security
**Priority**: P2
**Preconditions**: User A has booking ID X; User B is authenticated; ID Y is a known non-existent booking ID
**Steps**:
1. As User B, send `GET /api/bookings/X`, `GET /api/bookings/Y`
2. As User B, send `DELETE /api/bookings/X`, `DELETE /api/bookings/Y`
**Expected Results**: Documents the differential: GET on a foreign booking returns 403 while GET on a missing ID returns 404 — letting User B enumerate which booking IDs exist. DELETE returns 404 for both. Ownership failures should be indistinguishable from not-found on read as well
**Business Rule**: `getBookingById` (403) vs `cancelBooking` (404) in `backend/src/services/bookingService.js`; Rule 2
**Suggested Layer**: API

---

### TC-210: Script payload in customer fields is stored and rendered inert
**Category**: Security
**Priority**: P1
**Preconditions**: User is authenticated
**Steps**:
1. Create a booking with `customerName: "<img src=x onerror=alert(1)>"` (and an `<script>` payload in the same field)
2. Open `/bookings`, `/bookings/:id`, and `/admin/bookings`, and the admin View modal
**Expected Results**: The payload is displayed as literal text everywhere; no dialog fires and no element is injected into the DOM (React escapes text children). Verify no page uses `dangerouslySetInnerHTML` for these fields
**Business Rule**: `customerName` has no sanitization beyond `trim()` + min-length; XSS defense relies entirely on React escaping
**Suggested Layer**: E2E

---

### TC-211: Injection payloads in the booking-ref path parameter are handled safely
**Category**: Security
**Priority**: P2
**Preconditions**: User is authenticated
**Steps**:
1. Send `GET /api/bookings/ref/' OR '1'='1`
2. Send `GET /api/bookings/ref/%27%3B%20DROP%20TABLE%20Booking%3B--`
**Expected Results**: HTTP 404 "Booking with reference ... not found" for both; no 500, no SQL error text in the response, and the `Booking` table is intact afterwards (Prisma parameterizes the `findUnique`)
**Business Rule**: `bookingRepository.findByRef` — Prisma `findUnique` on `bookingRef`
**Suggested Layer**: API

---

### TC-212: `userId` in the request body cannot be used to book on another user's behalf
**Category**: Security
**Priority**: P0
**Preconditions**: User A is authenticated; User B's numeric ID is known
**Steps**:
1. As User A, send `POST /api/bookings` with a valid payload plus `"userId": <userB_id>`
2. List bookings as User A and as User B
**Expected Results**: The booking belongs to User A — the service takes `userId` from the verified JWT (`req.user.userId`) and never from the body; User B's list is unchanged
**Business Rule**: `bookingController.createBooking` passes `req.user.userId`; body `userId` is not in the validator whitelist
**Suggested Layer**: API

---

### TC-213: A user cannot book another user's dynamic event
**Category**: Security
**Priority**: P0
**Preconditions**: User A owns a dynamic event with ID E; User B is authenticated
**Steps**:
1. As User B, send `POST /api/bookings` with `eventId: E`
**Expected Results**: HTTP 404 "Event with id E not found" — the event lookup is scoped to `isStatic: true OR userId = caller`, so a foreign dynamic event is invisible; no booking row is created
**Business Rule**: `eventRepository.findById(id, userId)` scoping; Rule 2 sandbox isolation
**Suggested Layer**: API

---

## Negative / Error

### TC-300: Navigate to non-existent booking ID shows "Booking not found"
**Category**: Negative
**Priority**: P1
**Preconditions**: User is logged in
**Steps**:
1. Navigate to `/bookings/99999` (ID that does not exist)
**Expected Results**: Page shows "Booking not found" and "This booking doesn't exist or may have been cancelled." with "View My Bookings" button
**Business Rule**: `bookingService.getBookingById` throws NotFoundError → API returns 404; frontend renders not-found empty state
**Suggested Layer**: E2E

---

### TC-301: GET /api/bookings/:id with non-existent ID returns 404
**Category**: Negative
**Priority**: P1
**Preconditions**: User is authenticated
**Steps**:
1. Send `GET /api/bookings/99999` with valid JWT
**Expected Results**: HTTP 404; error message "Booking with id 99999 not found"
**Business Rule**: `bookingService.getBookingById` — NotFoundError
**Suggested Layer**: API

---

### TC-302: Create booking with insufficient seats returns 400
**Category**: Negative
**Priority**: P0
**Preconditions**: User is authenticated; event has 0 personal available seats (all booked by this user)
**Steps**:
1. Send `POST /api/bookings` with `quantity: 1` for a fully-booked event
**Expected Results**: HTTP 400; "Only 0 seat(s) available, but 1 requested"
**Business Rule**: `bookingService.createBooking` — `InsufficientSeatsError` when `personalAvailable < quantity`
**Suggested Layer**: API

---

### TC-303: Create booking for non-existent event returns 404
**Category**: Negative
**Priority**: P1
**Preconditions**: User is authenticated
**Steps**:
1. Send `POST /api/bookings` with `eventId: 99999`
**Expected Results**: HTTP 404; "Event with id 99999 not found"
**Business Rule**: `bookingService.createBooking` — event lookup fails → NotFoundError
**Suggested Layer**: API

---

### TC-304: Create booking with missing required fields returns 400
**Category**: Negative
**Priority**: P1
**Preconditions**: User is authenticated
**Steps**:
1. Send `POST /api/bookings` with missing `customerName`, `customerEmail`, or `customerPhone`
**Expected Results**: HTTP 400; validation error message listing missing fields
**Business Rule**: Input validators on the bookings route
**Suggested Layer**: API

---

### TC-305: Create booking with quantity = 0 or negative returns 400
**Category**: Negative
**Priority**: P1
**Preconditions**: User is authenticated
**Steps**:
1. Send `POST /api/bookings` with `quantity: 0`
2. Send `POST /api/bookings` with `quantity: -1`
**Expected Results**: HTTP 400; validation error for both cases
**Business Rule**: quantity must be 1–10 per booking model
**Suggested Layer**: API

---

### TC-306: Create booking with quantity > 10 returns 400
**Category**: Negative
**Priority**: P1
**Preconditions**: User is authenticated
**Steps**:
1. Send `POST /api/bookings` with `quantity: 11`
**Expected Results**: HTTP 400; validation error
**Business Rule**: quantity must be 1–10
**Suggested Layer**: API

---

### TC-307: Cancel a booking that has already been cancelled returns 404
**Category**: Negative
**Priority**: P1
**Preconditions**: User is authenticated; a booking exists
**Steps**:
1. Delete the booking via `DELETE /api/bookings/:id`
2. Attempt to delete the same booking again
**Expected Results**: HTTP 404; "Booking with id X not found"
**Business Rule**: `cancelBooking` uses `bookingRepository.findById` — not found after deletion
**Suggested Layer**: API

---

### TC-308: Bookings page shows error state when server is unreachable
**Category**: Negative
**Priority**: P2
**Preconditions**: Backend server is down or returns 500
**Steps**:
1. Navigate to `/bookings` with backend unavailable
**Expected Results**: Error empty state renders: "Couldn't load bookings", "Failed to connect to the server. Please try again.", and a "Retry" button
**Business Rule**: `isError` branch in `BookingsContent` component
**Suggested Layer**: Component / E2E

---

### TC-309: Booking form blocks submission client-side for invalid name/email/phone (no API call)
**Category**: Negative
**Priority**: P1
**Preconditions**: User is on `/events/:id` with the booking form visible
**Steps**:
1. Enter a name with 1 character, an email missing "@", and a phone with fewer than 10 digits
2. Click "Confirm Booking"
**Expected Results**: Inline field errors render ("Name must be at least 2 chars", "Enter a valid email", "Enter a valid 10-digit phone"); no `POST /api/bookings` request is sent (form has `noValidate` and runs its own `validate()` before calling `createBooking`)
**Business Rule**: Client-side `validate()` in `BookingForm` (`frontend/app/events/[id]/page.tsx`) mirrors but precedes backend `validateCreateBooking`
**Suggested Layer**: Component / E2E

---

### TC-310: A FAILED booking attempt at the 9-booking limit still destroys the oldest booking
**Category**: Negative
**Priority**: P0
**Preconditions**: User has exactly 9 bookings; note the oldest booking's ID and ref
**Steps**:
1. Send `POST /api/bookings` with a valid customer payload but `eventId: 99999` (non-existent)
2. Observe the response, then send `GET /api/bookings`
3. Repeat the same sequence with a valid event that has 0 personal seats left (expect the insufficient-seats error)
**Expected Results**: **Suspected defect.** The request fails (404 for the unknown event, 400 for insufficient seats) yet the user now has 8 bookings — the previously-oldest booking has been permanently deleted. FIFO pruning runs *before* the event-existence and seat checks, and there is no transaction or rollback, so a rejected booking silently destroys data. Expected behaviour: on any failure the booking count stays at 9 and no existing booking is removed
**Business Rule**: `bookingService.createBooking` — prune block (lines 70-79) precedes the event lookup (line 82) and the seat check (lines 86-92)
**Suggested Layer**: API

---

### TC-311: Non-numeric booking ID in the path returns a server error rather than a 4xx
**Category**: Negative
**Priority**: P1
**Preconditions**: User is authenticated
**Steps**:
1. Send `GET /api/bookings/abc`
2. Send `DELETE /api/bookings/abc`
3. Navigate the browser to `/bookings/abc`
**Expected Results**: `Number('abc')` yields `NaN`, which Prisma rejects — expect HTTP 500 with a generic error instead of a 400 "invalid id" (or a 404). Record the actual status; the route has no `isInt` param validator. The UI falls into the generic "Booking not found" empty state. Assert no stack trace or Prisma internals are exposed in the response body
**Business Rule**: `bookingRepository.findByIdOnly` / `findById` — `Number(id)` with no validation; contrast with `validateCreateBooking` which does validate `eventId`
**Suggested Layer**: API

---

### TC-312: Lookup by an unknown booking reference returns 404
**Category**: Negative
**Priority**: P2
**Preconditions**: User is authenticated
**Steps**:
1. Send `GET /api/bookings/ref/Z-ZZZZZZ` (a ref that does not exist)
**Expected Results**: HTTP 404 with `Booking with reference "Z-ZZZZZZ" not found`
**Business Rule**: `bookingService.getBookingByRef` — NotFoundError before the ownership check
**Suggested Layer**: API

---

### TC-313: page=0 or a negative page produces a negative offset
**Category**: Negative
**Priority**: P2
**Preconditions**: User is authenticated with at least one booking
**Steps**:
1. Send `GET /api/bookings?page=0`
2. Send `GET /api/bookings?page=-3`
**Expected Results**: `page=0` falls back to 1 (`Number(0) || 1`) and returns normal results; `page=-3` computes `skip = -40` which Prisma rejects — expect a 500 rather than a 400. No query parameter validation exists on this route; document the actual behaviour for both
**Business Rule**: `bookingService.getBookings` / `bookingRepository.findAll` — `skip = (page - 1) * limit`, unvalidated
**Suggested Layer**: API

---

### TC-314: Backend accepts phone values the UI rejects (validation divergence)
**Category**: Negative
**Priority**: P1
**Preconditions**: User is authenticated
**Steps**:
1. Send `POST /api/bookings` with `customerPhone: "----------"` (10 hyphens)
2. Send the same with `customerPhone: "() () () ()  "` and with `"+++++++++++"`
3. Enter the same values in the `/events/:id` booking form and submit
**Expected Results**: The API accepts them (HTTP 201) — it only checks length ≥ 10 and a character whitelist of `[0-9+\-\s()]`, never that any digits are present. The UI rejects them with "Enter a valid 10-digit phone" because it strips non-digits first. A booking with a digit-free phone number can therefore exist and will render on the detail page
**Business Rule**: `validateCreateBooking` `customerPhone` rules vs `BookingForm.validate()` (`form.customerPhone.replace(/\D/g,'').length < 10`)
**Suggested Layer**: API

---

### TC-315: Fractional quantity is rejected
**Category**: Negative
**Priority**: P2
**Preconditions**: User is authenticated
**Steps**:
1. Send `POST /api/bookings` with `quantity: 2.5`
2. Send with `quantity: "3"` (numeric string)
**Expected Results**: `2.5` → HTTP 400 "Quantity must be an integer between 1 and 10". `"3"` → accepted and coerced to integer 3 by `.toInt()`, with `totalPrice = price × 3`
**Business Rule**: `validateCreateBooking` — `isInt({min:1,max:10}).toInt()`
**Suggested Layer**: API

---

### TC-316: Malformed eventId is rejected by the validator
**Category**: Negative
**Priority**: P2
**Preconditions**: User is authenticated
**Steps**:
1. Send `POST /api/bookings` with `eventId: "abc"`, then `eventId: 0`, then `eventId: -5`, then `eventId: null`
**Expected Results**: All return HTTP 400 with details naming the `eventId` field ("Event ID must be a positive integer" / "Event ID is required"); the request never reaches the service, so no FIFO prune occurs (contrast with TC-310, where a *well-formed but non-existent* ID does reach the service and triggers the prune)
**Business Rule**: `validateCreateBooking` — `isInt({min:1})` on `eventId`
**Suggested Layer**: API

---

### TC-317: Cancelling the same booking twice from two tabs shows an error toast
**Category**: Negative
**Priority**: P2
**Preconditions**: User has a booking open on `/bookings` in two browser tabs
**Steps**:
1. In tab 1, cancel the booking and let it succeed
2. In tab 2 (still showing the stale card), cancel the same booking
**Expected Results**: Tab 2's request returns 404; an error toast shows the API message ("Booking with id X not found"); the confirm dialog closes; the stale card is removed once the list refetches. No unhandled error or blank page
**Business Rule**: `onError` in `BookingCard.handleCancel` surfaces `err.message` from the axios interceptor
**Suggested Layer**: E2E

---

### TC-318: POST with an empty body returns all field errors at once
**Category**: Negative
**Priority**: P2
**Preconditions**: User is authenticated
**Steps**:
1. Send `POST /api/bookings` with body `{}`
**Expected Results**: HTTP 400, `error: "Validation failed"`, and `details` containing one entry per missing field — `eventId`, `customerName`, `customerEmail`, `customerPhone`, `quantity` — each with `field` and `message`
**Business Rule**: `handleValidationErrors` maps `errors.array()` to `{ field, message }`
**Suggested Layer**: API

---

## Edge Cases

### TC-400: Exactly 9 bookings — adding a 10th prunes oldest from a DIFFERENT event (preferred)
**Category**: Edge Case
**Priority**: P0
**Preconditions**: User has exactly 9 bookings across multiple events
**Steps**:
1. Note the ID of the oldest booking (different event from the new booking's event)
2. Create a new (10th) booking for Event X
3. Check the bookings list
**Expected Results**: Count stays at 9; oldest booking (different event) is gone; new booking is present
**Business Rule**: `findOldestUserBookingExcludingEvent` preferential pruning in `bookingService.createBooking`
**Suggested Layer**: API

---

### TC-401: Exactly 9 bookings all from same event — 10th triggers same-event fallback and burns seat
**Category**: Edge Case
**Priority**: P1
**Preconditions**: User has 9 bookings all for Event X
**Steps**:
1. Create a new booking for Event X (10th)
2. Re-fetch Event X's available seats
**Expected Results**: Oldest booking removed; new booking created; `availableSeats` is permanently decremented by the new quantity (seat burned via `eventRepository.decrementSeats`)
**Business Rule**: `sameEventFallback = true` → `decrementSeats` called in `bookingService.createBooking`
**Suggested Layer**: API

---

### TC-402: Booking with quantity = 1 (minimum) — full happy path
**Category**: Edge Case
**Priority**: P1
**Preconditions**: User is logged in; event has available seats
**Steps**:
1. Navigate to event detail page
2. Leave quantity at 1 (default minimum)
3. Fill customer form and confirm booking
**Expected Results**: Booking created with `quantity: 1`; `totalPrice = price × 1`; booking ref generated
**Business Rule**: quantity boundary: 1 is minimum
**Suggested Layer**: E2E

---

### TC-403: Booking with quantity = 10 (maximum)
**Category**: Edge Case
**Priority**: P1
**Preconditions**: User is logged in; event has >= 10 available seats
**Steps**:
1. Navigate to event detail; click "+" 9 times to reach quantity 10
2. Fill form and confirm booking
**Expected Results**: Booking created with `quantity: 10`; `totalPrice = price × 10`; increment button disabled at 10
**Business Rule**: quantity boundary: 10 is maximum; UI should prevent going above 10
**Suggested Layer**: E2E

---

### TC-404: Refund eligibility boundary — quantity = 2 is NOT eligible (just above threshold)
**Category**: Edge Case
**Priority**: P1
**Preconditions**: User has a booking with quantity = 2
**Steps**:
1. Navigate to booking detail
2. Click "Check eligibility for refund?"
3. Wait 4 seconds
**Expected Results**: Result shows "Not eligible for refund. Group bookings (2 tickets) are non-refundable."
**Business Rule**: Rule 8 — threshold is quantity === 1; quantity = 2 is the first ineligible value
**Suggested Layer**: E2E

---

### TC-405: Booking reference uniqueness — collision retry mechanism
**Category**: Edge Case
**Priority**: P2
**Preconditions**: Many bookings exist with the same event title prefix (stress scenario)
**Steps**:
1. Create many bookings for events starting with the same letter
2. Verify each `bookingRef` is unique in DB
**Expected Results**: All booking references are unique; no duplicates; fallback timestamp-based ref used after 10 failed attempts
**Business Rule**: `generateUniqueRef` — up to 10 retries, then timestamp fallback
**Suggested Layer**: Unit

---

### TC-406: Clear all bookings when only one booking exists
**Category**: Edge Case
**Priority**: P2
**Preconditions**: User has exactly 1 booking
**Steps**:
1. Navigate to `/bookings`
2. Click "Clear all bookings" and confirm
**Expected Results**: Booking is deleted; page shows empty state; `DELETE /api/bookings` returns `{ deleted: 1 }`
**Business Rule**: `clearAllBookings` — `deleteAllForUser` returns count of deleted records
**Suggested Layer**: E2E / API

---

### TC-407: Pagination on bookings list (API) — page 2 with partial results
**Category**: Edge Case
**Priority**: P2
**Preconditions**: User has more than the default page limit of bookings visible in API
**Steps**:
1. Send `GET /api/bookings?page=2&limit=5`
**Expected Results**: Returns page 2 results; `pagination.page = 2`; `data` array contains at most 5 items
**Business Rule**: Pagination behavior in `bookingService.getBookings`
**Suggested Layer**: API

---

### TC-408: Event title starting with a number — booking ref prefix is uppercase of that character
**Category**: Edge Case
**Priority**: P2
**Preconditions**: An event exists whose title starts with a digit (e.g., "100 Days Festival")
**Steps**:
1. Book the event
2. Check the `bookingRef`
**Expected Results**: `bookingRef` starts with "1-XXXXXX" (digit is used as-is, `toUpperCase()` has no effect on digits)
**Business Rule**: `randomRef` — `prefix = (eventTitle?.[0] ?? 'E').toUpperCase()`
**Suggested Layer**: API / Unit

---

### TC-409: Booking form quantity is capped at available seats when fewer than 10 remain
**Category**: Edge Case
**Priority**: P1
**Preconditions**: A dynamic event has fewer than 10 seats available (e.g., 3 remaining for this user)
**Steps**:
1. Navigate to `/events/:id` for the low-seat event
2. Click "+" repeatedly to try to exceed available seats
**Expected Results**: `(max 3)` label is shown; the "+" button becomes disabled once `quantity === availableSeats` (not 10); quantity never exceeds `availableSeats`
**Business Rule**: `maxQty = Math.min(10, event.availableSeats)` in `BookingForm` (`frontend/app/events/[id]/page.tsx`)
**Suggested Layer**: E2E / Component

---

### TC-410: The 9-booking cap makes the bookings page a single page in practice
**Category**: Edge Case
**Priority**: P2
**Preconditions**: User has the maximum 9 bookings
**Steps**:
1. Navigate to `/bookings`
2. Inspect the `GET /api/bookings?page=1&limit=10` response
**Expected Results**: `pagination.total = 9`, `limit = 10`, `totalPages = 1`. Because the FIFO cap (9) is below the page size (10), the `Pagination` control can never show more than one page for a normal user — TC-510's multi-page assertion is unreachable through the UI and is only testable by calling the API with a smaller `limit`
**Business Rule**: Rule 4 (max 9 bookings) vs `limit: 10` in `BookingsContent` (`frontend/app/bookings/page.tsx:22-25`)
**Suggested Layer**: E2E / API

---

### TC-411: `limit` is not capped at the documented maximum
**Category**: Edge Case
**Priority**: P3
**Preconditions**: User is authenticated
**Steps**:
1. Send `GET /api/bookings?limit=1000`
2. Send `GET /api/bookings?limit=0` and `?limit=abc`
**Expected Results**: `limit=1000` is honoured despite Swagger documenting `maximum: 100` — no server-side clamp exists. `limit=0` and `limit=abc` both fall back to 10 via `Number(limit) || 10`. Note the divergence between the documented contract and the implementation
**Business Rule**: `bookingService.getBookings` — `Number(filters.limit) || 10`, no upper bound; Swagger `limit.maximum: 100` in `bookingRoutes.js`
**Suggested Layer**: API

---

### TC-412: customerName boundary — 1 char rejected, 2 chars accepted
**Category**: Edge Case
**Priority**: P1
**Preconditions**: User is authenticated
**Steps**:
1. Send `POST /api/bookings` with `customerName: "A"`
2. Send with `customerName: "Al"`
3. Send with `customerName: "  A  "` (single char padded with spaces)
**Expected Results**: "A" → 400 "Customer name must be at least 2 characters"; "Al" → 201; `"  A  "` → 400, since `.trim()` runs before the length check. Confirm the accepted name is stored trimmed
**Business Rule**: `validateCreateBooking` — `.trim().isLength({min:2})`
**Suggested Layer**: API

---

### TC-413: customerPhone length boundary — 9 vs 10 characters
**Category**: Edge Case
**Priority**: P1
**Preconditions**: User is authenticated
**Steps**:
1. Send `POST /api/bookings` with `customerPhone: "123456789"` (9 digits)
2. Send with `customerPhone: "1234567890"` (10 digits)
3. Send with `customerPhone: "+91 98765 43210"` (15 chars incl. spaces)
**Expected Results**: 9 digits → 400 "Customer phone must be at least 10 digits"; 10 digits → 201; the formatted number → 201 and is stored verbatim, spaces included (no normalization). Note the check is on total character count, not digit count (see TC-314)
**Business Rule**: `validateCreateBooking` — `.isLength({min:10})` plus the `[0-9+\-\s()]` whitelist
**Suggested Layer**: API

---

### TC-414: Fractional totals are rounded in the UI but stored exactly
**Category**: Edge Case
**Priority**: P2
**Preconditions**: User owns a dynamic event priced at 99.99
**Steps**:
1. Book 3 tickets (expected exact total 299.97)
2. Compare the API `totalPrice` with the value shown on `/bookings`, `/bookings/:id`, and `/admin/bookings`
**Expected Results**: API returns `299.97` (Decimal(10,2)); every UI surface displays `$300` because `fmt_price` uses `maximumFractionDigits: 0`. Cents are never shown to the user — flag as a display defect if exact amounts matter
**Business Rule**: Rule 9 `totalPrice = price × quantity`; `fmt_price` in the bookings pages/components
**Suggested Layer**: E2E / Component

---

### TC-415: Booking ref prefix for titles starting with a non-letter
**Category**: Edge Case
**Priority**: P2
**Preconditions**: User can create dynamic events with arbitrary titles
**Steps**:
1. Create events titled `" Leading Space Fest"`, `"🎉 Party Night"`, and `"#1 Rated Show"`
2. Book each and read the `bookingRef`
**Expected Results**: The prefix is `eventTitle[0].toUpperCase()` taken literally — a space, the first UTF-16 code unit of the emoji, or `#` respectively. Confirm the ref still matches `^.-[A-Z0-9]{6}$` in shape and that a leading-space prefix does not break `GET /api/bookings/ref/:ref` lookup (the space must be URL-encoded)
**Business Rule**: Rule 7 / `randomRef` — `(eventTitle?.[0] ?? 'E').toUpperCase()`, no sanitization of the prefix character
**Suggested Layer**: API / Unit

---

### TC-416: Over-long customer field values
**Category**: Edge Case
**Priority**: P3
**Preconditions**: User is authenticated
**Steps**:
1. Send `POST /api/bookings` with a 300-character `customerName`
**Expected Results**: There is no max-length validator, so the value hits the MySQL `VARCHAR(191)` column — expect a 500 from Prisma rather than a 400 with a clear message. Record the actual status and assert the error body does not leak the Prisma/SQL error text
**Business Rule**: `validateCreateBooking` enforces only `min: 2`; `Booking.customerName` is a default-length Prisma `String`
**Suggested Layer**: API

---

### TC-417: A booking survives its event's date passing
**Category**: Edge Case
**Priority**: P3
**Preconditions**: A dynamic event exists whose `eventDate` can be moved into the past (directly in DB, since the event validator forbids past dates on write)
**Steps**:
1. Book the event, then set its `eventDate` to yesterday
2. Load `/bookings` and `/bookings/:id`
**Expected Results**: The booking still lists and opens normally with status "confirmed"; the past date renders without an "expired"/"past event" indicator; refund eligibility still evaluates on quantity alone. There is no event-date-based filtering or state anywhere in booking management
**Business Rule**: No past-event handling exists in `bookingService` or the booking UI
**Suggested Layer**: E2E

---

### TC-418: FIFO prune when the oldest booking's event was deleted
**Category**: Edge Case
**Priority**: P2
**Preconditions**: User has 9 bookings; the oldest belongs to a dynamic event that is then deleted
**Steps**:
1. Build up 9 bookings, noting the oldest
2. Delete the event behind the oldest booking (which cascades that booking away — count drops to 8)
3. Create a new booking
**Expected Results**: The count is 8 before step 3, so no prune is triggered and the new booking brings the total back to 9 without removing anything. Verifies the interaction between cascade deletion (TC-113) and the FIFO counter
**Business Rule**: Rule 4 FIFO cap is evaluated from a live `countUserBookings`, not a stored counter
**Suggested Layer**: API

---

### TC-419: Cancelling a booking while the refund check is still running
**Category**: Edge Case
**Priority**: P3
**Preconditions**: User is on `/bookings/:id` for a multi-ticket booking
**Steps**:
1. Click "Check eligibility for refund?"
2. Within the 4-second window, click "Cancel Booking" and confirm
**Expected Results**: Cancellation succeeds and redirects to `/bookings`; the pending 4s `setTimeout` fires after the component has unmounted — assert no React state-update-after-unmount warning or error overlay appears in the console, and that the redirect is not interrupted
**Business Rule**: `RefundEligibility.check` uses a bare `setTimeout` with no cleanup on unmount
**Suggested Layer**: E2E

---

## UI State

### TC-500: Bookings list shows skeleton loading state while fetching
**Category**: UI State
**Priority**: P1
**Preconditions**: User navigates to `/bookings` (slow network or first load)
**Steps**:
1. Navigate to `/bookings` with throttled network
2. Observe the page before data loads
**Expected Results**: 5 `BookingCardSkeleton` placeholders are shown while `isLoading = true`; no real booking data yet
**Business Rule**: `isLoading` branch in `BookingsContent`
**Suggested Layer**: Component / E2E

---

### TC-501: Bookings list shows empty state when user has no bookings
**Category**: UI State
**Priority**: P1
**Preconditions**: User is logged in with zero bookings
**Steps**:
1. Navigate to `/bookings`
**Expected Results**: Empty state renders with "No bookings yet", "You haven't booked any events yet..." description, and "Browse Events" button linking to `/events`
**Business Rule**: `bookings.length === 0` branch in `BookingsContent`
**Suggested Layer**: E2E / Component

---

### TC-502: Booking detail page shows loading spinner while fetching
**Category**: UI State
**Priority**: P2
**Preconditions**: User navigates to `/bookings/:id` on slow network
**Steps**:
1. Navigate to `/bookings/:id` with throttled network
2. Observe the page before data loads
**Expected Results**: Full-screen spinner (`Spinner size="lg"`) is visible while `isLoading = true`
**Business Rule**: `isLoading` branch in `BookingDetailPage`
**Suggested Layer**: Component

---

### TC-503: Cancel booking confirmation dialog appears before deletion
**Category**: UI State
**Priority**: P0
**Preconditions**: User is on a booking detail page
**Steps**:
1. Click "Cancel Booking" button
2. Observe dialog
**Expected Results**: `ConfirmDialog` appears with title "Cancel this booking?", description mentioning the booking ref and seat count, "Yes, cancel it" and close buttons
**Business Rule**: Two-step confirmation prevents accidental cancellations
**Suggested Layer**: E2E / Component

---

### TC-504: Cancel booking dialog close without confirming does NOT cancel
**Category**: UI State
**Priority**: P1
**Preconditions**: User is on a booking detail page
**Steps**:
1. Click "Cancel Booking"
2. Click the close/dismiss button on the dialog (not "Yes, cancel it")
3. Observe booking status
**Expected Results**: Dialog closes; booking remains in the list; no API call made
**Business Rule**: `onClose` sets `confirm = false`; `handleCancel` only runs on confirm
**Suggested Layer**: E2E

---

### TC-505: Booking detail breadcrumb displays the booking reference
**Category**: UI State
**Priority**: P2
**Preconditions**: User navigates to a valid booking detail page
**Steps**:
1. Navigate to `/bookings/:id`
2. Observe the breadcrumb nav at the top
**Expected Results**: Breadcrumb shows "My Bookings / {bookingRef}" where bookingRef is in monospace font
**Business Rule**: Breadcrumb uses `booking.bookingRef`
**Suggested Layer**: E2E

---

### TC-506: Cancel booking success — toast and redirect
**Category**: UI State
**Priority**: P0
**Preconditions**: User confirms booking cancellation
**Steps**:
1. Confirm cancellation in the dialog
2. Observe page transition and notifications
**Expected Results**: Success toast "Booking cancelled successfully" appears; user is redirected to `/bookings`
**Business Rule**: `onSuccess` callback in `handleCancel`
**Suggested Layer**: E2E

---

### TC-507: "Clear all bookings" button shows "Clearing..." while in progress
**Category**: UI State
**Priority**: P2
**Preconditions**: User has bookings; network is slow
**Steps**:
1. Click "Clear all bookings" and confirm dialog
2. Observe the button state while request is in flight
**Expected Results**: Button text changes to "Clearing…" and is disabled (`disabled:opacity-50`) during the API call
**Business Rule**: `clearing` state variable in `BookingsContent`
**Suggested Layer**: Component / E2E

---

### TC-508: Refund eligibility — "Check eligibility" button hidden after result shown
**Category**: UI State
**Priority**: P2
**Preconditions**: User is on a booking detail page in idle refund state
**Steps**:
1. Click "Check eligibility for refund?"
2. Wait for result to appear
**Expected Results**: After status transitions from "idle" → "checking" → "eligible/ineligible", the initial button is no longer visible; spinner replaces it during check; result card replaces spinner after 4 seconds
**Business Rule**: `RefundEligibility` component status state machine: idle → checking → eligible/ineligible
**Suggested Layer**: E2E / Component

---

### TC-509: Booking detail shows "Access Denied" state for 403 errors
**Category**: UI State
**Priority**: P0
**Preconditions**: Another user's booking ID is known
**Steps**:
1. Log in as User B
2. Navigate to `/bookings/:userA_booking_id`
3. Observe the rendered state
**Expected Results**: `EmptyState` with title "Access Denied" and description "You are not authorized to view this booking." renders (not "Booking not found")
**Business Rule**: Frontend checks `error.status === 403` to differentiate Access Denied vs Not Found
**Suggested Layer**: E2E

---

### TC-510: Bookings page pagination UI renders when total exceeds page size
**Category**: UI State
**Priority**: P2
**Preconditions**: API returns `pagination.totalPages > 1`
**Steps**:
1. Navigate to `/bookings` with enough bookings to trigger multi-page response
2. Observe pagination controls
**Expected Results**: `Pagination` component renders with correct `currentPage` and `totalPages`; clicking next page updates URL `?page=N` and loads next page of bookings
**Business Rule**: Pagination in `BookingsContent` driven by `pagination` from API response
**Suggested Layer**: E2E / Component

---

### TC-511: Sold-out event shows disabled "Sold Out" button on the booking form
**Category**: UI State
**Priority**: P1
**Preconditions**: An event has `availableSeats === 0` for this user
**Steps**:
1. Navigate to `/events/:id` for the sold-out event
2. Observe the booking form's submit button
**Expected Results**: Button labeled "Sold Out" (instead of "Confirm Booking") and disabled (`disabled={soldOut}`); no booking can be submitted
**Business Rule**: `soldOut = event.availableSeats === 0` in `BookingForm` (`frontend/app/events/[id]/page.tsx`)
**Suggested Layer**: E2E / Component

---

### TC-512: "Clear all bookings" uses a native browser confirm, and dismissing it aborts
**Category**: UI State
**Priority**: P1
**Preconditions**: User has at least one booking
**Steps**:
1. Navigate to `/bookings` and click "Clear all bookings"
2. Dismiss the browser dialog (Cancel)
3. Click "Clear all bookings" again and accept the dialog
**Expected Results**: Step 1 raises a **native `window.confirm`** — "Clear all your bookings? This cannot be undone." — not the styled `ConfirmDialog` used for single cancellations. Dismissing sends no request and leaves all bookings intact; accepting clears them. Automation must register a dialog handler (`page.on('dialog', …)`) before clicking, otherwise Playwright auto-dismisses it and the test silently asserts nothing
**Business Rule**: `handleClearAll` in `frontend/app/bookings/page.tsx:27-36` — `if (!confirm(...)) return;`
**Suggested Layer**: E2E

---

### TC-513: Clear-all control is still shown when there are no bookings
**Category**: UI State
**Priority**: P2
**Preconditions**: User has zero bookings
**Steps**:
1. Navigate to `/bookings` and confirm the "No bookings yet" empty state is rendered
2. Click "Clear all bookings" and accept the confirm dialog
**Expected Results**: The control is visible and enabled alongside the empty state; clicking it issues `DELETE /api/bookings`, which returns 200 "0 booking(s) cleared". No error appears, but the control is offering a destructive action with nothing to delete — flag as a UX issue (it should be hidden or disabled when `bookings.length === 0`)
**Business Rule**: Unconditional header in `BookingsContent`; see TC-109 and TC-117
**Suggested Layer**: E2E / Component

---

### TC-514: Admin bookings "Cancelled" status filter can never return results
**Category**: UI State
**Priority**: P2
**Preconditions**: User is on `/admin/bookings` with several confirmed bookings
**Steps**:
1. Select "Cancelled" in the status dropdown
2. Select "Confirmed", then "All Statuses"
**Expected Results**: "Cancelled" always yields the "No bookings found" empty state — cancellation deletes rows and no code path ever writes `status: 'cancelled'` (TC-112), so the filter option is dead. "Confirmed" and "All Statuses" return identical result sets. Selecting a filter also resets the page to 1
**Business Rule**: `STATUS_OPTIONS` in `frontend/app/admin/bookings/page.tsx:14-18` vs the hard-coded `status: 'confirmed'` in `bookingService.createBooking`
**Suggested Layer**: E2E

---

### TC-515: Admin bookings header shows the total booking count
**Category**: UI State
**Priority**: P3
**Preconditions**: User has a known number of bookings (e.g. 4)
**Steps**:
1. Navigate to `/admin/bookings` and read the subtitle under "Manage Bookings"
2. Cancel one booking and re-read it
**Expected Results**: Subtitle reads "4 total bookings", then "3 total bookings" after the cancellation; it is driven by `pagination.total` (the full count), not by the number of rows on the current page
**Business Rule**: `pagination.total` rendered in the admin page header
**Suggested Layer**: E2E / Component

---

### TC-516: Ticket count pluralization on booking cards
**Category**: UI State
**Priority**: P3
**Preconditions**: User has one booking with quantity 1 and one with quantity 3
**Steps**:
1. Navigate to `/bookings` and read the ticket line on each card
**Expected Results**: The single-ticket card reads "🎫 1 ticket" (singular) and the other reads "🎫 3 tickets" (plural). The same pluralization applies to the price-summary line on the booking form
**Business Rule**: `{booking.quantity} ticket{booking.quantity > 1 ? 's' : ''}` in `BookingCard.jsx`
**Suggested Layer**: Component

---

### TC-517: The "cancelled" booking presentation is unreachable
**Category**: UI State
**Priority**: P3
**Preconditions**: Ability to set `status = 'cancelled'` on a booking row directly in the DB
**Steps**:
1. Flip one booking's status to "cancelled" in the DB
2. Load `/bookings`, `/bookings/:id`, and `/admin/bookings`
**Expected Results**: The status badge switches to the red/danger variant and the "Cancel Booking"/"Cancel" buttons are hidden (all three surfaces guard on `status === 'confirmed'`). Confirms the branch works, while documenting that no API path can produce this state — cancellation deletes the row instead
**Business Rule**: `status === 'confirmed'` guards in `BookingCard`, the detail page, and the admin table; `bookingService.cancelBooking` deletes rather than updates
**Suggested Layer**: Component

---

### TC-518: Booking detail falls back gracefully when the event relation is missing
**Category**: UI State
**Priority**: P3
**Preconditions**: A booking response where `event` is null (simulate by stubbing the API response)
**Steps**:
1. Load `/bookings/:id` with the stubbed response
**Expected Results**: The page renders without crashing: the heading falls back to "Event Booking", the event fields and "Price per ticket" render as blanks/"—", and "Total Paid" still shows the stored `totalPrice`. The booking card similarly falls back to "Event" and "—" for the date
**Business Rule**: `booking.event?.title ?? 'Event Booking'` and the `booking.event ? … : '—'` guards in the detail page and `BookingCard`
**Suggested Layer**: Component

---

### TC-519: Unauthenticated navigation to booking pages redirects to login
**Category**: UI State
**Priority**: P0
**Preconditions**: `localStorage` has no `eventhub_token`
**Steps**:
1. Navigate directly to `/bookings`
2. Navigate directly to `/bookings/1` and `/admin/bookings`
**Expected Results**: Each route briefly shows the full-screen spinner while auth resolves, renders no booking content, and redirects to `/login` via `router.replace` (so Back does not return to the guarded page)
**Business Rule**: `AuthGuard` (`frontend/components/auth/AuthGuard.tsx`) — non-public paths require a resolved user
**Suggested Layer**: E2E

---

### TC-520: Cancel dialog cannot be dismissed while the request is in flight
**Category**: UI State
**Priority**: P2
**Preconditions**: User is cancelling a booking on a throttled network
**Steps**:
1. Open the cancel confirmation dialog and click "Yes, cancel it"
2. While the request is pending, click the "Cancel" button, the dialog backdrop, and press Escape
**Expected Results**: The confirm button shows its loading state, the "Cancel" button is disabled, and `onClose` is withheld (`onClose={!isLoading ? onClose : undefined}`) so backdrop/Escape do not close the dialog until the request settles; no duplicate `DELETE` is sent
**Business Rule**: `ConfirmDialog` (`frontend/components/ui/ConfirmDialog.jsx:16-25`) — `isLoading` locks the dialog
**Suggested Layer**: E2E / Component
