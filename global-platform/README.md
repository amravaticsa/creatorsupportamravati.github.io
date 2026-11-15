# CSA Global — Platform Foundation

This directory is a front-end design foundation for the CSA Global managed editing network.

## Current decisions
- Project allocation: CSA-managed.
- Editor registration: open worldwide and free.
- Client payment: collected by CSA.
- Editor project flow: project offer → accept → review project-specific agreement → pay/verify refundable security deposit → assignment confirmation.
- Deposit is not charged at registration or merely for receiving an offer.
- Client-facing service and quality management remain with CSA; editors are independent contractors, not to be misrepresented as employees.

## Pages
- `index.html`: platform landing page.
- `client-project.html`: detailed client tender brief form.
- `editor-register.html`: free worldwide editor registration form.
- `admin-preview.html`: illustrative internal dashboard.

## Cloudflare D1 foundation
- Database created: `csa-global-platform`
- Database UUID: `23462947-5ab9-41ea-a25a-0fac0e6349d7`
- Primary location: APAC; read replication: automatic
- Applied migrations: `0001_initial.sql` and `0002_editor_payout_and_disputes.sql`
- Tables cover users, clients, editors, skills, portfolios, projects, files, offers, agreements, acceptances, payments, deposit ledger, assignments, milestones, submissions, revisions, messages, notifications, disputes and audit logs.
- This database is separate from the existing `csa-orders` database.

## Important implementation status
These pages are static UI previews. Forms intentionally do not submit or persist data. Authentication, authorization, database, file storage, payment gateway, payment webhooks, email/WhatsApp notifications, legal agreement acceptance records and secure editor/client separation are NOT implemented.

Do not collect real personal information, client footage, bank details or deposits through these preview pages.

## Production architecture proposal
- Frontend: current static website / dedicated application.
- API: Cloudflare Workers.
- Database: Cloudflare D1.
- Private media: Cloudflare R2 with short-lived signed access.
- Authentication: secure identity provider or properly implemented passwordless/session authentication.
- Payments: a provider that expressly supports the business model, currencies, cross-border collections and permitted payouts.
- Security: role-based access, MFA for staff, audit logs, rate limiting, CSRF protections, strict server-side authorization and verified payment webhooks.

## Required production gates
1. Confirm legal entity, terms, privacy, contractor agreement, deposit/refund policy and cross-border compliance.
2. Confirm supported payment collection and editor payout countries with payment provider and professional adviser.
3. Implement backend and database migrations.
4. Implement role-scoped APIs and secure file access.
5. Implement idempotent payment webhooks and deposit ledger.
6. Add automated tests, security review and backups.
7. Deploy to staging, test end-to-end, then launch only after approval.

No credentials, API keys or secrets belong in this repository.


## Current staging build
- API Worker: `csa-global-api` at `https://csa-global-api.creatorsupportamravati.workers.dev`
- Separate D1 database with migrations 0001–0003 applied.
- Google sign-in and Razorpay deposit routes are implemented in the staging Worker source; activation awaits client ID and Razorpay credentials.
- Client/editor Google login page and authenticated portal source are in this development branch. The UI is not published to the main website.
- Test-mode Razorpay is required before any live deposit collection.
