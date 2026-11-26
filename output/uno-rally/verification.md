# UNO RALLY verification

Current result: the full live booking widget is restored, and layouts are modernized using the original Dink Lab black-and-white palette, Orbitron type, silver gradients, and glass surfaces.

## Booking fixes

- Removed the placeholder that replaced the booking widget.
- Removed the extra QR environment-variable submission gate introduced during rebranding.
- Restored existing GoTyme/BPI QR asset defaults, with optional image overrides.
- Availability uses the admin's current pricing bands and operating hours.
- Unloaded availability cannot be selected; an explicitly empty schedule stays empty.
- Availability errors have retry controls on desktop and in the mobile booking overlay.
- Customers can open the mobile schedule before choosing guest or Google access. Authentication remains required to select/book court time.
- Guest and Google connection failures return actionable errors.
- Restarted the existing localhost:3000 development server with the restored .env.local and network access.

## Layouts

Floating site navigation; asymmetric hero with booking CTA; grouped amenity cards; schedule with sticky desktop payment column; responsive payment form; customer-history workspace; two-column sign-in dialog; confirmation/feedback layout; announcements; venue/map details; footer; admin sidebar with all existing workspace tabs retained.

## Passed checks

- Production build: npm run build.
- Lint: npm run lint.
- Six isolated regressions: npm run test:booking. Database and email boundaries are mocked; these tests do not create live reservations or send messages.
- Live availability at localhost:3000 for both courts on November 5, 2026: HTTP 200, 17 hourly slots each, 14 available, configured rates PHP 200 / 250 / 300.
- Homepage: HTTP 200, live booking controls rendered, no unavailable-placeholder replacement.
- Admin access without a session: HTTP 307 to home.
- Booking history and proof-upload APIs without a session: HTTP 401.
- Existing payment QR image: HTTP 200.
- Supabase Auth settings: Google and anonymous sign-ins enabled.
- Cloudinary authenticated ping: HTTP 200.
- SMTP connection/authentication verification passed; no email sent.
- .env.local is ignored by Git; no credentials were printed or committed.

## Verification limits

No live booking was created, no payment was made, and no real payment-proof file was uploaded. Successful multi-hour writes and conflict handling were tested against mocked service boundaries. Visual/browser interaction checks were unavailable because browser inventory was empty. Full Google OAuth, guest interaction, and checkout were not exercised in a browser.

## Original court-booking design restored (November 5, 2026)

- Restored the original Dink Lab booking heading/pricelist, desktop schedule and payment proportions, mobile payment form, and confirmation view from Git HEAD. UNO RALLY branding and booking connection/retry fixes remain.
- Removed modern booking progress, sticky-payment, two-column mobile-payment, and confirmation layout overrides. Other modernized pages were kept.
- Original mobile-payment and confirmation source comparisons passed. Desktop payment matches the original except for its branded QR download filename.
- Build, lint, and all six booking regressions passed.
- localhost:3000 rendered the original heading and desktop column classes. Both court availability APIs returned HTTP 200 with 17 slots each for November 6, 2026.
