# Beauty Clinic CRM: Delivery Plan

| | |
|---|---|
| **Status** | Active planning |
| **Last updated** | 2026-10-29 |
| **Related** | [01-project-description.md](01-project-description.md), [03-architecture.md](03-architecture.md), [04-database.md](04-database.md) |

## 1. Approach

The project is built in vertical slices. Each phase ends with something the owner can use from start to finish, not a half-built layer. Each phase has exit criteria, and the owner tests the result at the end of the phase.

The system goes live only after a two-week parallel run, during which the owner records every booking in both the new system and the current process (WhatsApp and paper).

## 2. Timing assumptions

- About 15 to 20 hours of development per week.
- Durations are estimates. Meta approval and owner feedback are outside the developer's control, so they are tracked as dependencies (section 6).

## 3. Phases

### Phase 0: Setup (about 1 week)

**Goal:** a deployable skeleton with working login and no features.

**Tasks**

- Create a monorepo with `apps/web` (Next.js) and `apps/api` (Express).
- Create two Vercel projects, one for each app, linked to the repository.
- Create Supabase projects for staging and production, and set up the Supabase CLI for local development.
- Configure TypeScript, linting, and a test runner.
- Configure environment variables for each environment.
- Add error tracking and a `/health` endpoint.
- Start Meta Business Manager verification and register the clinic's WhatsApp Business number. This is an external wait, so it starts now.
- Draft WhatsApp message templates for the owner to review.

**Exit criteria**

- The owner can log in on staging and see an empty dashboard.
- The API health check responds on Vercel.
- Meta verification has been submitted.

### Phase 1: Core booking and clients (about 3 weeks)

**Goal:** the owner can book appointments, manage clients, and record visits.

**Tasks**

- Owner account creation, login, logout, and protected routes.
- Clinic settings screen: name, phone, timezone, and reminder send time.
- Service catalog: create, edit, and deactivate services across the four categories, with duration, USD price, and follow-up interval.
- Client profiles: create, edit, and search by name or phone. Prevent duplicate phone numbers. Record WhatsApp consent, source, and notes.
- Calendar: day and week views. Create, reschedule, cancel, complete, and mark no-show. Refuse overlapping bookings with a clear message.
- Visit notes attached to each appointment.
- Client history page: visits and notes. Payment and message sections are added in later phases.
- Client import from CSV, with a preview step and an error report.
- Audit logging for every write.

**Exit criteria**

- The owner can run a full day of bookings and record visit notes.
- An attempt to double-book is refused.
- The owner's real client list imports without unresolved errors.

### Phase 2: Packages and payments (about 2 weeks)

**Goal:** multi-session packages and cash payments in USD or LBP work correctly.

**Tasks**

- Package templates: service, number of sessions, price, and validity period.
- Selling a package to a client. The sessions, price, and expiry date are copied into the sale, so later template changes don't affect it.
- Booking an appointment against a package.
- The `complete_appointment` database function, which deducts one session inside a transaction.
- Package balance shown on the client page and on the calendar.
- Exchange rate settings: enter a new LBP-per-USD rate, with a history list.
- Recording payments in cash, USD or LBP, with the USD equivalent stored.
- Voiding a payment with a reason. Nothing is deleted.
- Payment history on the client page.

**Exit criteria**

- A 5-session package deducts correctly across five visits, and a sixth visit is refused.
- Two completions at the same time cannot use the last session twice.
- Cancelled and no-show appointments follow the no-show rule the owner chooses (see the open questions in the project description).
- LBP payments store the exchange rate used.

### Phase 3: Reminders and WhatsApp (about 3 weeks, including approval wait)

**Goal:** WhatsApp reminders are sent automatically, on schedule, and only to eligible clients.

**Tasks**

- Scheduling rules:
  - Appointment reminder the day before the visit.
  - Follow-up after the service's follow-up interval.
  - Package renewal when one session remains or the package is close to expiry.
- Submit templates in Meta Business Manager and wait for approval.
- Send function: send an approved template and store the WhatsApp message ID.
- Daily job endpoint, protected by `CRON_SECRET`, plus the Vercel Cron configuration.
- Eligibility checks at send time: consent given, not opted out, and the appointment is still scheduled.
- Webhook endpoint with signature verification, storing delivery and read status.
- Opt-out handling: an incoming "STOP" message marks the client as opted out.
- Message log in the app, and a list of failed messages on the dashboard.
- Staging sends only to approved test numbers.

**Exit criteria**

- Reminders reach test numbers at the scheduled time.
- Running the job twice sends nothing twice.
- Delivery status appears in the app.
- A client who has opted out receives nothing.

### Phase 4: Dashboard and polish (about 1.5 weeks)

**Goal:** the owner can run the day from a phone.

**Tasks**

- Dashboard: today's appointments, the next seven days, follow-ups due, packages nearing renewal, and today's revenue in USD with the LBP equivalent.
- Responsive pass at phone, tablet, and laptop widths.
- Empty, loading, and error states on every screen.
- Basic accessibility: contrast, form labels, and keyboard navigation.
- Performance check on a slow connection.

**Exit criteria**

- The owner can run a full day from a phone.
- Typical pages load in under two seconds.

### Phase 5: Pilot and launch (about 2 weeks)

**Goal:** the system replaces the old process safely.

**Tasks**

- Import the real client list and check for duplicates and invalid numbers.
- Write a short owner runbook covering daily use, failed messages, rate changes, and restoring a backup.
- Test a backup restore on staging.
- Run in parallel for two weeks: every booking goes into the system and the old process.
- Fix issues found during the pilot. Freeze scope during this time.
- Switch over, so the old process stops being used for new bookings.
- Watch production closely for the first two weeks.

**Exit criteria**

- Two consecutive weeks in which every booking was made in the system and none were missed.

## 4. Timeline summary

| Phase | Duration | Cumulative | Notes |
|---|---|---|---|
| 0. Setup | 1 week | 1 week | Start Meta verification here |
| 1. Core booking and clients | 3 weeks | 4 weeks | |
| 2. Packages and payments | 2 weeks | 6 weeks | |
| 3. Reminders and WhatsApp | 3 weeks | 9 weeks | Includes the template approval wait |
| 4. Dashboard and polish | 1.5 weeks | 10.5 weeks | |
| 5. Pilot and launch | 2 weeks | 12.5 weeks | |

At 15 to 20 hours a week, this is roughly three months.

## 5. Milestones

| Milestone | Target | Meaning |
|---|---|---|
| M1 | End of week 1 | Staging is live with login |
| M2 | Week 4 | Owner can book and record visits |
| M3 | Week 6 | Packages and payments work |
| M4 | Week 9 | Reminders reach test numbers |
| M5 | Week 12 to 13 | Production launch |

## 6. External dependencies

| Dependency | Responsible | Needed by | Lead time |
|---|---|---|---|
| Meta Business Manager verification | Owner, with developer | Phase 3 | Days to weeks |
| A WhatsApp number dedicated to the clinic | Owner | Phase 3 | Before Meta registration |
| WhatsApp template approval | Meta | Phase 3 | Days. Rejected templates must be rewritten and resubmitted |
| Vercel and Supabase plans | Developer | Phase 0 | Immediate. Check plan limits first |
| Service list, prices, and package offers | Owner | Phase 1 and 2 | Ask at the start of Phase 0 |
| Starting exchange rate | Owner | Phase 2 | Immediate |
| Client list export | Owner | Phase 5 | Request during Phase 1 |
| Weekly feedback session | Owner | Every phase | 30 minutes a week |

## 7. Testing strategy

- **Unit tests:** time-overlap logic, package balance calculation, USD and LBP conversion, and reminder eligibility rules.
- **Integration tests against local Supabase:** the overlap constraint, simultaneous completions of the last package session, and idempotency keys.
- **API tests:** success and error responses for every endpoint.
- **Web tests:** the critical flows (login, book, complete a visit, sell a package, record a payment) with Playwright.
- **Manual test script per phase,** run by the owner on staging.
- **WhatsApp tests:** only against approved test numbers in staging.

## 8. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Meta verification or template approval is delayed | Medium | High | Start in Phase 0. Keep a click-to-chat fallback ready so launch isn't blocked |
| A template is rejected | Medium | Medium | Use plain, transactional wording. Keep copies of approved templates |
| Scope creep | High | High | Freeze MVP scope. Keep a parking-lot list for new ideas |
| The owner doesn't adopt the system | Medium | High | Review each phase with the owner. Run the parallel pilot |
| Data loss or a bad import | Low | High | Daily backups, a tested restore, and an import preview with a dry run |
| Duplicate reminders | Low | High | Unique constraint on messages. The job is idempotent |
| Wrong exchange rate used | Medium | Medium | Keep rate history. Show the rate on each LBP payment |
| Reminder batch hits serverless time limits | Low | Medium | Process in batches. Monitor run duration |
| Developer availability | Medium | High | Keep phases small. Leave slack in the timeline |

## 9. Definition of done

A feature is done when:

- It works at phone, tablet, and laptop widths.
- Validation and error states are handled.
- Every write is recorded in the audit log.
- Tests for its business rules pass.
- The owner has tried it on staging.
- The API documentation is updated.

## 10. Post-launch roadmap (not scheduled)

1. Staff accounts and roles.
2. An online booking link for Instagram and WhatsApp.
3. Before-and-after photos, with consent.
4. Reports: revenue by service, repeat-visit rate, and package usage.
5. More than one service per appointment.
6. Multi-branch support.

## 11. Working agreement

- A 30-minute review with the owner each week, using the staging system.
- Scope changes go to the parking-lot list. They are scheduled after launch unless they block a phase.
- Each phase closes with a short demo and a written note of what changed.
