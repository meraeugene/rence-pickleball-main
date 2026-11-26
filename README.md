# UNO RALLY

UNO RALLY is a Next.js App Router website for booking pickleball court slots, submitting payment proof, reviewing bookings as an admin, and managing court business rules.

The app supports guest sessions and Google sign-in through Supabase Auth, customer booking history, admin booking review, court schedules, editable pricing/hours/courts, Cloudinary payment proof uploads, and SMTP booking acceptance emails with calendar invitations.

## UNO RALLY Brand Setup

UNO RALLY retains Dink Lab's black-and-white palette, Orbitron font, silver gradients, and glass components. The header uses Dink Lab's compact, top-aligned layout: 56px on mobile and 64px on larger screens, transparent at the top and tinted after scrolling, with a smaller UNO RALLY logo. Modern responsive layouts cover the hero, grouped amenity cards, customer history, sign-in dialogs, venue details, footer, and admin workspace with sidebar navigation. Court booking and checkout use the original Dink Lab design: full-width pricelist above the schedule, schedule left and payment right on desktop, and the original mobile booking/payment flow. Connection error and retry handling remain available. The request gate lives in `src/proxy.ts`.

Run `npm run dev` and open http://localhost:3000. Restart the dev server after restoring or changing `.env.local`. Real availability, sign-in, and booking writes use the configured Supabase project; payment proof uploads use Cloudinary. The complete booking widget stays on the page. Missing service configuration or a failed availability request produces an explicit retry/error state and never creates fake availability or reservations. The original payment QR assets remain the defaults; optional image overrides do not disable booking.

The hero uses a single text column without the extra reservation card. The separate “Getting you courtside…” route loader has been removed. The remaining splash overlay is fixed to the full viewport and locks document scrolling until it unmounts, independently of booking modal scroll styles.

Run `npm test` for all regressions, or `npm run test:admin` for admin custom bookings, expenses, payments, Excel export and hourly rates. Run `npm run test:booking` for isolated booking regressions covering custom pricing, authoritative availability, authentication, multi-hour inserts, conflicts, duplicate selections, and payment-proof validation. These tests replace database/email boundaries and do not create live bookings or send messages.

Run `node --test scripts/siteHeader.test.mjs` for navigation regressions covering tall booking sections, restored scroll positions, layout changes, mobile resizing, and page-bottom selection. Header activation follows section positions instead of visibility percentages.


Set these optional public venue fields in `.env.local`. Empty contact fields stay unpublished; the previous brand's address, phone, social page, and map are not reused.

```text
NEXT_PUBLIC_VENUE_ADDRESS=
NEXT_PUBLIC_VENUE_PHONE=
NEXT_PUBLIC_VENUE_MAPS_URL=
NEXT_PUBLIC_VENUE_SOCIAL_URL=
NEXT_PUBLIC_GOTYME_QR_IMAGE=
NEXT_PUBLIC_BPI_QR_IMAGE=
```

For QR images, use a root-relative public asset path, such as `/uno-rally-gotyme-qr.jpg`, after adding the verified venue QR image to `public/`. The active customer flow uses GoTyme; BPI remains supported by the shared QR component. Remote QR URLs are not needed. If no override is set, the existing GoTyme/BPI QR images in `public/` are used, preserving the original payment flow.

Confirm the new venue's prices, operating hours, admin recipients, and service accounts before using live bookings. The old booking import title and JSON backup format identifier remain supported for compatibility; the workbook importer also accepts `UNO RALLY BOOKING LIST`. Court and booking data have not been migrated or reset.

Brand assets are in `public/uno-rally-*.png`. The supplied logo was prepared as a transparent website asset with the built-in ImageGen tool. The homepage uses `uno-rally-court-hero.png`, an illustrative edit of the original Dink Lab court image with UNO RALLY branding on the wall, floor, and nets. The original image and earlier court concept remain available as unused assets. The location badge reads Cagayan de Oro Pickleball. Announcements use a stacked, full-width layout, and the splash logo is capped at 128px on mobile and 160px on larger screens. Asset prompts and preparation notes are in [output/uno-rally/asset-notes.md](output/uno-rally/asset-notes.md).

## Features

### Public And Customer

- Public landing page with venue details, court booking CTA, pricing, amenities, tournament section, and location details.
- Guest booking through Supabase anonymous sessions, or Google OAuth sign-in.
- Multi-step booking widget:
  - choose court,
  - choose date,
  - choose time,
  - choose payment method,
  - submit payment proof or onsite payment.
- Dynamic court list from admin settings.
- Dynamic pricing bands and operating hours from admin settings. Current rates: 8:00 AM–3:00 PM ₱300/hr, 3:00 PM–10:00 PM ₱350/hr, 10:00 PM–1:00 AM ₱380/hr (`supabase/migrations/20261125030000_update_pricing_bands.sql`).
- Atomic slot blocking when the customer submits a completed booking form.
- Payment screenshots stay in browser memory until submission, with automatic
  cleanup when a booking attempt fails.
- Availability checks against pending requests and confirmed bookings.
- Customer booking history for Google and same-browser guest sessions:
  - pending,
  - confirmed,
  - rejected,
  - cancelled.
- Customer can cancel pending bookings.

### Admin

- Protected `/admin` dashboard for configured admin emails only.
- Review Queue:
  - booking cards,
  - payment proof preview,
  - record additional payments or mark a reservation fully paid,
  - color-coded partial and fully paid indicators,
  - accept booking,
  - reject booking,
  - reschedule all court schedules in an accepted reservation together,
  - add another court while rescheduling,
  - cancel an accepted reservation and release all of its slots,
  - conflict warning for already-reserved slots,
  - filters by status, court, date, payment method, and search text.
- Court Schedule:
  - day view,
  - previous/next date controls,
  - confirmed slots grouped by court and hour.
- Expenses & Profit (all admins):
  - manual expense modal with date, category, description, and amount,
  - edit and delete logged expenses (delete asks for confirmation),
  - categories: Utilities, Rent, Staff / Salaries, Equipment, Maintenance, Supplies, Marketing, Other,
  - recurring monthly expenses ("Repeat every month"): added automatically on the same day each
    month (or the month's last day), with edit, pause/resume, and remove; resuming skips paused months,
  - revenue is the cash recorded on accepted bookings, counted on the play date (Manila time),
  - net profit = revenue collected − expenses, plus profit margin and amount still to collect,
  - comparison with the previous period on revenue, expenses, and profit,
  - period: month, year, custom date range, or all time,
  - chart grouping: daily, weekly (Mon–Sun), monthly, or yearly,
  - revenue by court, revenue by time slot (pricing band of the booking start hour), and spend by category,
  - expense search and category filters,
  - Excel export of the current view (summary, trend, expenses, category, court, time slot) and CSV export of the listed expenses,
  - requires `supabase/migrations/20261125000000_add_expenses.sql` and
    `supabase/migrations/20261125020000_add_recurring_expenses.sql`.
- Court Schedule tools:
  - import the UNO RALLY `.xlsx` booking-list format into Court Schedule,
  - group imported courts sharing the same customer, date, and time as one reservation.
  - permanently delete an individual Excel-imported reservation after confirmation.
- Reset Data:
  - admin-only reset tab,
  - hard deletes booking records only,
  - keeps courts, pricing, hours, and admins,
  - requires typing `RESET BOOKINGS`,
  - best-effort Cloudinary payment proof cleanup.

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase Auth and database
- Supabase SSR helpers
- SWR for client-side refresh
- Cloudinary for payment proof images
- Nodemailer / SMTP for new-booking admin notifications and customer acceptance emails
- Zod for validation
- Lucide React icons

## Project Structure

```text
src/app/
  (root)/                 Public/customer page
  (admin)/admin/          Admin dashboard route
  api/                    API route handlers
  auth/callback/          Supabase OAuth callback

src/actions/
  admin/                  Admin server actions
  bookings/               Booking server actions

src/components/
  admin/                  Admin dashboard UI
  booking-widget/         Customer booking flow
  customer-bookings/      Customer booking history
  home/                   Landing page sections
  system/                 App/system UI

src/hooks/                SWR hooks and client workflows
src/utils/                Supabase, booking, admin, email, payment helpers
src/types/                Shared domain types
supabase/                 Consolidated SQL schema
public/                   Static assets
```

## Requirements

- Node.js 20 or newer recommended
- npm
- Supabase project
- Google OAuth configured in Supabase
- Cloudinary account for payment proof uploads
- SMTP account for email sending

## Environment Variables

Create `.env.local` with the values below.

```bash
# Create .env.local and fill in the values below.
```

Required variables:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

NEXT_PUBLIC_APP_URL=http://localhost:3000
ADMIN_EMAILS=

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_UPLOAD_FOLDER=
CRON_SECRET=

SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=
SMTP_APP_PASSWORD=
SMTP_FROM=
```

Notes:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are safe public browser values.
- `SUPABASE_SERVICE_ROLE_KEY`, Cloudinary secrets, and SMTP password must stay server-only.
- `ADMIN_EMAILS` is no longer used. Admin access is locked to `andrewvillalon.dev@gmail.com` and `unorally2026@gmail.com` via `DEFAULT_ADMIN_EMAILS` in `src/data/app/appConfig.ts`.
- `CLOUDINARY_UPLOAD_FOLDER` defaults in code to `uno-rally/payment-proofs` when empty.
- `NEXT_PUBLIC_APP_URL` should be the deployed domain in production.

## Supabase Setup

1. Create a Supabase project.
2. Open the Supabase SQL editor.
3. Run:

```sql
-- paste and run supabase/schema.sql
```

> **Warning:** `supabase/schema.sql` is a destructive full reset. It deletes and
> recreates UNO RALLY application tables and their data. Supabase Auth users are
> not deleted. Use it for a new project or only after backing up data you need.

For an existing database that already contains bookings, run only the
non-destructive SQL in
`supabase/migrations/20260821000000_add_booking_payment_update.sql`. This adds
the admin payment-update function without resetting booking data.

Then run
`supabase/migrations/20260821010000_add_admin_booking_pagination.sql` to add
database-side admin filtering, grouping, pagination, and accurate result
counts without resetting booking data.

Then run
`supabase/migrations/20260822000000_allow_excel_import_schedule_conflicts.sql`
if that temporary behavior was deployed, followed by
`supabase/migrations/20260822010000_disallow_excel_import_schedule_conflicts.sql`
to restore conflict protection without deleting existing rows.

Then run `supabase/migrations/20261125000000_add_expenses.sql` to add the
`expenses` table used by the admin Expenses & Profit tab. It is safe to run more
than once. The table has row level security enabled with no policies, so only
server actions using the service-role key (after an admin check) can read or
write it. The destructive `schema.sql` reset keeps existing expenses.

Then run `supabase/migrations/20261125020000_add_recurring_expenses.sql` for
recurring monthly expenses. It adds the `recurring_expenses` table and the
`generate_recurring_expenses` function, which the dashboard calls each time an
admin opens it, so no cron job is needed.

4. Confirm these tables exist:
   - `admins`
   - `courts`
   - `bookings`
   - `booking_settings`
   - `pricing_bands`
   - `expenses`
   - `recurring_expenses`

5. Confirm these enum values exist:
   - booking status: `PENDING_REVIEW`, `ACCEPTED`, `CANCELLED`, `REJECTED`
   - payment method: `BPI`, `GOTYME`, `ONSITE`

6. Admin emails are fixed to `andrewvillalon.dev@gmail.com` and
   `unorally2026@gmail.com`:
   - in code: `DEFAULT_ADMIN_EMAILS` in `src/data/app/appConfig.ts`
   - in the database: run `supabase/migrations/20261125010000_restrict_admins.sql`
     to remove every other row from `public.admins`

The schema seeds:

- Court 1 and Court 2
- default operating hours: `8` to `25` meaning 8:00 AM to 1:00 AM next day
- pricing:
  - Day, 8 AM to 3 PM, PHP 300/hr
  - Evening, 3 PM to 10 PM, PHP 350/hr
  - Late Night, 10 PM to 1 AM, PHP 380/hr

## Supabase Authentication

Enable both Anonymous Sign-Ins and Google OAuth in Supabase Auth. Guest history is
tied to the anonymous browser session and cannot be recovered after cookies are
cleared or on another device.

Add redirect URLs:

```text
http://localhost:3000/auth/callback
https://your-production-domain.com/auth/callback
```

The app redirects admins to `/admin` after sign-in when their email is configured as an admin.

## Install And Run

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Admin dashboard:

```text
http://localhost:3000/admin
```

## Available Scripts

```bash
npm run dev
```

Runs the local development server.

```bash
npm run lint
```

Runs ESLint.

```bash
npm run build
```

Creates a production build and runs TypeScript checks.

```bash
npm run start
```

Runs the production build locally after `npm run build`.

## Booking Flow

1. User opens the booking widget and chooses guest access or Google.
2. Guest access creates an anonymous Supabase session and can optionally collect an email for notifications and a calendar invite.
3. User chooses court, date, and time.
4. User completes the payment details without reserving the selected slots yet.
5. User chooses payment method:
   - BPI
   - GoTyme
   - Onsite
6. User submits the completed booking form.
7. The database atomically creates a `PENDING_REVIEW` booking and makes its slots unavailable.
8. The configured admin email addresses receive a new-booking notification with a link to the review dashboard.
9. Admin accepts or rejects the booking.
10. Accepted bookings become `ACCEPTED`.
11. When a customer email is available, an acceptance email and `.ics` calendar invitation are sent through SMTP.

Opening payment, downloading the QR code, going back, closing the booking flow, or refreshing does not affect slot availability. Submitted bookings make slots unavailable while pending. Accepted bookings mark slots as reserved. Rejected or cancelled bookings make their slots available again.

## Admin Review Behavior

Admins can:

- add one onsite booking with multiple court and time schedules through Direct Entry,
- accept pending bookings,
- reject pending bookings,
- reschedule all schedule items in an accepted reservation with editable courts, dates, start times, and end times,
- add another court schedule during rescheduling,
- cancel an accepted reservation group and immediately release its slots,
- view payment proof,
- filter and search booking submissions,
- rely on the database to prevent overlapping active submissions.

When accepting a booking, the database function `accept_pending_booking` checks for accepted slot conflicts before updating the status.

Rescheduling recalculates each schedule item's duration, total, and paid or half-paid amount from the active pricing bands. The grouped database operation is atomic: every replacement schedule succeeds together or none are changed. The database rejects replacement times that overlap a pending or accepted booking. Cancelling does not issue a payment refund automatically; admins must handle refunds separately.

## Courts, Hours, And Pricing

There is no in-app editor for courts, operating hours, or pricing bands. Change
them directly in the `courts`, `booking_settings`, and `pricing_bands` tables in
Supabase. They are used by:

- booking widget price cards,
- available time slots,
- booking total calculations,
- admin schedule view.

## Reset Data

The Reset Data tab is for testing/demo cleanup.

It deletes:

- all rows in `bookings`

It keeps:

- admins,
- courts,
- pricing bands,
- booking settings.

To reset, type:

```text
RESET BOOKINGS
```

Then click `Reset Bookings`.

Cloudinary payment proof deletion is best-effort. If Cloudinary cleanup fails, the booking reset can still succeed.

## API Routes

Important API routes:

```text
GET    /api/availability
GET    /api/bookings/accepted
GET    /api/bookings/history
GET    /api/admin/bookings
GET    /api/admin/schedule
GET    /api/admin/notifications
POST   /api/cloudinary/upload
DELETE /api/cloudinary/delete
GET    /api/cron/cleanup-payment-proofs
```

Admin APIs require admin access. Customer booking APIs require a signed-in user where applicable.
The payment-proof cleanup API requires `Authorization: Bearer <CRON_SECRET>`.

## Server Actions

Important server actions:

- `createManualBooking`
- `acceptBooking`
- `cancelManualBooking`
- `cancelUserBooking`
- `resetBookingData`
- `createExpense`, `updateExpense`, `deleteExpense`
- `updateRecurringExpense`, `setRecurringExpenseActive`, `deleteRecurringExpense`
- `exportProfitReport`
- `getProfitDashboard`

Authorization checks happen inside server actions and are not left to client UI only.

## Data And Time Rules

- Stored booking timestamps are timezone-aware.
- Display is based on Asia/Manila.
- Operating hours can extend past midnight by using values greater than 24.
- Example: close hour `25` means 1:00 AM next day.
- Selecting a slot and completing payment details do not reserve it.
- Selecting a payment screenshot creates only a local browser preview. The image
  uploads to Cloudinary after the user submits and availability is rechecked.
- Failed booking attempts delete their unreferenced Cloudinary upload immediately.
- The scheduled cleanup deletes unreferenced payment proofs older than one hour.
- Submitting the completed form atomically makes the slot unavailable while pending.
- Accepted bookings mark their slots as reserved.
- Rejected or cancelled bookings make their slots available again.

## QA Checklist

Before deployment or after meaningful changes:

```bash
npm run lint
npm run build
```

Manual checks:

- Home page loads.
- Sign in with Google works.
- Guest booking creates an anonymous session and retains history in the same browser.
- Guest booking works with and without an optional notification email.
- Booking widget completes all steps.
- Payment proof upload works.
- Refreshing before submission does not create a Cloudinary upload.
- A failed booking submission removes its unreferenced Cloudinary proof.
- The cleanup route preserves proofs referenced by any booking.
- Pending booking appears in customer booking history.
- Admin Review Queue receives the booking.
- Admin filters/search work.
- Admin can accept a booking.
- Admin can reschedule multiple courts together with new start and end times.
- Rescheduling recalculates pricing and commits all replacement schedules atomically.
- Admin can cancel an accepted reservation and release all grouped slots.
- Admin can permanently delete any individual reservation group without affecting other bookings. Excel imports are insert-only: they never delete or replace existing system bookings, and conflicting rows are skipped.
- Admins can download a versioned JSON backup of all booking records and preview a non-destructive restore. Restore inserts missing booking IDs only, preserves current records, and skips slot conflicts.
- Admin Direct Entry can add multiple courts and time ranges as one grouped onsite booking.
- Multiple customers can enter payment for the same available slot, but only the first completed submission succeeds.
- Pending and accepted bookings block the same slot.
- Customer can cancel pending booking.
- Admin can reject pending booking.
- Court Schedule shows accepted bookings.
- Reset Data clears bookings only.
- Mobile widths do not horizontally overflow.

Recommended responsive widths:

```text
320px
375px
768px
1024px
1440px
```

## Developer Testing Tools

Current built-in checks:

- ESLint via `npm run lint`
- Next/TypeScript production build via `npm run build`

Recommended future tools:

- Playwright for browser end-to-end tests
- Vitest for pricing/time/availability unit tests
- Lighthouse for accessibility/performance checks

Suggested Playwright install:

```bash
npm install -D @playwright/test
npx playwright install
```

Suggested Vitest install:

```bash
npm install -D vitest
```

## Deployment

Vercel is the expected deployment target.

Deployment checklist:

1. Add all `.env.local` values to Vercel environment variables.
2. Generate a random `CRON_SECRET` of at least 16 characters and add it to Vercel.
3. Set `NEXT_PUBLIC_APP_URL` to the production domain.
4. Add the production auth callback URL in Supabase.
5. Back up required application data, then run the consolidated
   `supabase/schema.sql` in Supabase when initializing or intentionally resetting
   the database.
6. Confirm `public.admins` contains only the two admin emails (run the restrict-admins migration).
7. Deploy. `vercel.json` registers the cleanup job for 02:00 UTC daily.
8. Test customer booking and admin acceptance in production.

The cleanup endpoint always uses a one-hour stale threshold. Vercel Hobby supports
daily cron invocations; on a plan that supports hourly cron jobs, change the
schedule in `vercel.json` to `0 * * * *`.

## Troubleshooting

### Admin cannot access `/admin`

Check:

- user is signed in,
- email is one of the two in `DEFAULT_ADMIN_EMAILS`,
- email exists in `public.admins`,
- Supabase auth session is active.

### Payment proof upload fails

Check:

- Cloudinary env vars,
- upload folder,
- file size/type,
- `/api/cloudinary/upload` response in browser Network tab.

### Payment proof cleanup does not run

Check:

- `CRON_SECRET` exists in the production environment,
- the Vercel Cron Jobs page shows `/api/cron/cleanup-payment-proofs`,
- the cleanup route logs do not show Cloudinary Admin API errors.

### Booking email does not send

Check:

- SMTP env vars,
- Gmail app password if using Gmail,
- SMTP host/port/secure values.

Booking submission and acceptance still succeed even if email sending fails. New-booking admin notifications are sent to both admin addresses in `DEFAULT_ADMIN_EMAILS`. Set `LIMIT_BOOKING_NOTIFICATION_EMAILS_TO_OWNER` in `src/data/app/appConfig.ts` to `true` only when notifications must temporarily go to `andrewvillalon.dev@gmail.com`.

### Booking schema error appears

Back up required application data, then run the consolidated
`supabase/schema.sql`. The schema is a destructive reset and recreates booking
review fields, `REJECTED` status, submission-time overlap protection, business
settings, and pricing bands.

### Reset Data does not remove images

Cloudinary cleanup is best-effort. The booking rows can still be deleted even if image cleanup fails. Check Cloudinary credentials and stored `payment_proof_public_id` values.

## Security Notes

- Never expose `SUPABASE_SERVICE_ROLE_KEY`.
- Never prefix server secrets with `NEXT_PUBLIC_`.
- Keep `.env.local` out of git.
- Admin actions must keep server-side authorization checks.
- Client UI should never be treated as the only security layer.

## License

Private project.
