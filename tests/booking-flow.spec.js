import { test as base, expect, request as apiRequest } from '@playwright/test';

/**
 * Booking Management — core E2E journeys (docs/test-strategy.md §5a)
 *
 *   TC-001  View bookings list with existing bookings
 *   TC-002  View single booking detail page
 *   TC-003  Cancel a single booking from the detail page  (absorbs TC-506: toast + redirect)
 *
 * Setup is API-driven (test-strategy.md §7 anti-pattern 3 and §10 build order 3):
 * the `seed` fixture below creates a dynamic event + booking over HTTP, so the
 * data under assertion is deterministic — exact title, price, quantity and ref —
 * instead of whatever "the first bookable card" happens to be that day.
 *
 * Page URLs come from `baseURL` in playwright.config.ts (§7 anti-pattern 10).
 */

// The frontend talks to a separate API host; override with EVENTHUB_API_URL.
const API_BASE = process.env.EVENTHUB_API_URL || 'http://localhost:3001/api';

const USER_EMAIL    = 'rahulshetty1@gmail.com';
const USER_PASSWORD = 'Magiclife1!';

// Fixed booking payload — integer price keeps the `$` formatting exact
// (fmt_price uses maximumFractionDigits: 0).
const TICKET_PRICE = 150;
const QUANTITY     = 2;
const CUSTOMER = {
  customerName:  'Priya Sharma',
  customerEmail: 'priya.sharma@example.com',
  customerPhone: '9876543210',
};

const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

/**
 * Opens a brand-new APIRequestContext, so an API call made after the UI steps
 * starts from a clean connection pool instead of reusing a socket the test-scoped
 * `request` fixture left idle during the browser work.
 */
const freshApi = () => apiRequest.newContext();

/**
 * Logs in over the API, clears the shared test account's bookings, then creates a
 * dedicated dynamic event and one booking against it.
 *
 * A freshly created event (never a static one) is required by test-strategy.md §9:
 * cancelling restores seats, and doing that to a shared static event drains it a
 * little more on every CI run.
 *
 * @returns {Promise<{token: string, event: object, booking: object}>} the API's own view of the seeded rows
 */
async function seedBooking(request) {
  // Log in
  const loginRes = await request.post(`${API_BASE}/auth/login`, {
    data: { email: USER_EMAIL, password: USER_PASSWORD },
  });
  expect(loginRes.status(), 'API login should succeed').toBe(200);
  const { token } = await loginRes.json();

  // Start from zero bookings so counts and the empty state are deterministic
  const clearRes = await request.delete(`${API_BASE}/bookings`, { headers: authHeader(token) });
  expect(clearRes.ok(), 'clearing existing bookings should succeed').toBeTruthy();

  // Create the event under test
  const eventRes = await request.post(`${API_BASE}/events`, {
    headers: authHeader(token),
    data: {
      title:       `E2E Booking Flow ${Date.now()}`,
      description: 'Event created by the booking-flow E2E suite. Safe to delete.',
      category:    'Conference',
      venue:       'Automation Arena',
      city:        'Bangalore',
      eventDate:   new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      price:       TICKET_PRICE,
      totalSeats:  50,
    },
  });
  expect(eventRes.status(), 'event creation should succeed').toBe(201);
  const event = (await eventRes.json()).data;

  // Book it
  const bookingRes = await request.post(`${API_BASE}/bookings`, {
    headers: authHeader(token),
    data: { eventId: event.id, quantity: QUANTITY, ...CUSTOMER },
  });
  expect(bookingRes.status(), 'booking creation should succeed').toBe(201);
  const booking = (await bookingRes.json()).data;

  return { token, event, booking };
}

/**
 * Deletes the seeded event; the cascade drops any booking left behind.
 *
 * The first API call issued during Playwright's teardown phase is intermittently
 * reset by the deployed host ("socket hang up") — the identical request succeeds
 * from the test body, and an immediate retry succeeds here. Retrying is confined
 * to teardown: no assertion about the application depends on it, and the last
 * transport error is reported if every attempt fails.
 */
async function deleteEvent(token, eventId) {
  let res = null;
  let lastError = null;

  for (let attempt = 1; attempt <= 3 && !res; attempt++) {
    const api = await freshApi();
    try {
      res = await api.delete(`${API_BASE}/events/${eventId}`, { headers: authHeader(token) });
    } catch (err) {
      lastError = err;   // transport-level reset — try again on a new connection
    } finally {
      await api.dispose();
    }
  }

  expect(
    res && res.ok(),
    `cleanup: seeded event ${eventId} should be deleted` +
      (res ? ` (last status ${res.status()})` : ` (last transport error: ${lastError?.message})`),
  ).toBeTruthy();
}

/**
 * Per-test seed. Each test gets its own event + booking and its own teardown, so
 * no state leaks between tests and nothing depends on execution order.
 */
const test = base.extend({
  seed: async ({ request }, use) => {
    const seed = await seedBooking(request);
    await use(seed);
    await deleteEvent(seed.token, seed.event.id);
  },
});

/** Logs in through the UI so the browser session holds a real JWT. */
async function login(page) {
  await page.goto('/login');
  await page.getByPlaceholder('you@email.com').fill(USER_EMAIL);
  await page.getByLabel('Password').fill(USER_PASSWORD);
  await page.locator('#login-btn').click();
  await expect(page.getByTestId('logout-btn')).toBeVisible();
}

/**
 * Scopes assertions to one card on the booking detail page.
 * The section wrappers carry no data-testid, so they are reached through their
 * <h2> heading — the class filter only narrows to the card element itself.
 */
const detailSection = (page, title) =>
  page
    .locator('.bg-white.rounded-2xl')
    .filter({ has: page.getByRole('heading', { level: 2, name: title }) });

/** The detail page's Date field, formatted the way fmt_date renders it. */
const longDate = (iso) =>
  new Date(iso).toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

test.describe('Booking flow — core journeys', () => {
  test('TC-001: bookings list renders a card with ref, event, quantity and total', async ({ page, seed }) => {
    const { event, booking } = seed;

    // -- Step 1: Log in and open the bookings list --
    await login(page);
    await page.goto('/bookings');

    // -- Step 2: Exactly the seeded booking is listed --
    const cards = page.getByTestId('booking-card');
    await expect(cards).toHaveCount(1);

    // -- Step 3: The card carries every field the scenario names --
    await expect(cards.getByText(booking.bookingRef, { exact: true })).toBeVisible();
    await expect(cards.getByRole('heading', { name: event.title })).toBeVisible();
    await expect(cards).toContainText('confirmed');
    await expect(cards).toContainText(`${QUANTITY} tickets`);
    await expect(cards).toContainText(`$${TICKET_PRICE * QUANTITY}`);   // Rule 9: price × quantity
    await expect(cards.getByTestId('booking-id')).toHaveText(`#${booking.id}`);

    // -- Step 4: "View Details" points at this booking --
    await expect(cards.getByRole('link', { name: 'View Details' }))
      .toHaveAttribute('href', `/bookings/${booking.id}`);
  });

  test('TC-002: detail page shows event, customer, payment, refund and metadata sections', async ({ page, seed }) => {
    const { event, booking } = seed;

    // -- Step 1: Reach the detail page the way a user does --
    await login(page);
    await page.goto('/bookings');
    const cards = page.getByTestId('booking-card');
    await expect(cards).toHaveCount(1);   // guards the click below against a stale account
    await cards.getByRole('link', { name: 'View Details' }).click();
    await expect(page).toHaveURL(new RegExp(`/bookings/${booking.id}$`));

    // -- Step 2: Header — event title and the ref in both breadcrumb and badge --
    await expect(page.getByRole('heading', { level: 1, name: event.title })).toBeVisible();
    await expect(page.getByText(booking.bookingRef, { exact: true })).toHaveCount(2);

    // -- Step 3: Event details --
    const eventSection = detailSection(page, 'Event Details');
    await expect(eventSection).toContainText(event.title);
    await expect(eventSection).toContainText(event.category);
    await expect(eventSection).toContainText(longDate(event.eventDate));
    await expect(eventSection).toContainText(event.venue);
    await expect(eventSection).toContainText(event.city);

    // -- Step 4: Customer details, asserted against the values the API stored --
    const customerSection = detailSection(page, 'Customer Details');
    await expect(customerSection).toContainText(booking.customerName);
    await expect(customerSection).toContainText(booking.customerEmail);
    await expect(customerSection).toContainText(booking.customerPhone);

    // -- Step 5: Payment summary — Rule 9, totalPrice = price × quantity --
    const paymentSection = detailSection(page, 'Payment Summary');
    await expect(paymentSection.getByText(String(QUANTITY), { exact: true })).toBeVisible();
    await expect(paymentSection).toContainText(`$${TICKET_PRICE}`);
    await expect(paymentSection).toContainText(`$${TICKET_PRICE * QUANTITY}`);

    // -- Step 6: Refund entry point (Rule 8 — client-side only) and booking metadata --
    await expect(page.getByTestId('check-refund-btn')).toHaveText('Check eligibility for refund?');
    await expect(detailSection(page, 'Booking Information')).toContainText(`#${booking.id}`);
  });

  test('TC-003: cancelling from the detail page toasts, redirects and removes the booking', async ({ page, seed }) => {
    const { token, booking } = seed;

    // -- Step 1: Open the booking's detail page --
    await login(page);
    await page.goto(`/bookings/${booking.id}`);
    await expect(page.getByText(booking.bookingRef, { exact: true }).first()).toBeVisible();

    // -- Step 2: Cancel and confirm in the dialog --
    await page.getByRole('button', { name: 'Cancel Booking' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Cancel this booking?');
    await dialog.getByTestId('confirm-dialog-yes').click();

    // -- Step 3: Success toast, then redirect back to the list --
    await expect(page.getByText('Booking cancelled successfully')).toBeVisible();
    await expect(page).toHaveURL(/\/bookings$/);

    // -- Step 4: The booking is gone — it was the only one, so the empty state shows --
    await expect(page.getByText('No bookings yet')).toBeVisible();
    await expect(page.getByTestId('booking-card')).toHaveCount(0);

    // -- Step 5: Cancellation deleted the record, it was not just hidden --
    const api = await freshApi();
    const lookupStatus = await api
      .get(`${API_BASE}/bookings/${booking.id}`, { headers: authHeader(token) })
      .then((res) => res.status())
      .finally(() => api.dispose());
    expect(lookupStatus, 'cancelled booking should no longer exist').toBe(404);
  });
});
