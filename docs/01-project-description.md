# Beauty Clinic CRM: Project Description

| | |
|---|---|
| **Status** | Planning |
| **Developer** | Hady |
| **Primary user** | Clinic owner |
| **Last updated** | 2026-10-29 |

## 1. Summary

A web application that gives one beauty clinic a single place to manage clients, appointments, treatment history, packages, payments, and automated WhatsApp reminders. It replaces the current approach, where bookings and client details are tracked through phone calls, WhatsApp, and Instagram messages.

## 2. Problem

Based on discovery with the owner, the three most important problems are:

- **Double-bookings and scheduling conflicts.** Appointments are arranged in chat threads, which makes it easy for slots to overlap or be lost.
- **Clients who don't come back.** Follow-ups depend on memory, so repeat visits are missed.
- **Scattered client history.** Treatment details and preferences live in phone chats and Instagram DMs, so the owner can't see a client's full history in one place.

Packages, payments in USD and LBP, and reminders are also needed. They are covered in the scope below.

## 3. Goals

### Business goals

1. No double-bookings once the system is live.
2. More repeat visits through timely follow-ups and package reminders.
3. One place to see any client's history, packages, and payments.

### Technical goals

1. Simple enough for one developer to build, deploy, and operate.
2. Usable on laptop, tablet, and phone from one responsive web app.
3. Designed so staff roles and extra branches can be added later without a rewrite.

## 4. Users

| User | Access in MVP | Notes |
|---|---|---|
| Clinic owner | Full access | The only user at launch. Logs in with email and password. |
| Future staff | None | Roles are planned for phase 2. |
| Clients | None directly | Receive WhatsApp messages only. No client portal in the MVP. |

## 5. Scope

### In scope (MVP)

- Owner login
- Clinic settings: name, timezone, and daily reminder send time
- Service catalog: four categories (facials and skin care, laser and injectables, hair and nails, waxing and body treatments), each with a duration, a price in USD, and an optional follow-up interval
- Client profiles: contact details, Instagram handle, source, WhatsApp consent, and notes
- Appointment calendar: manual booking, rescheduling, cancellation, completion, and no-show, with overlap prevention
- Visit notes for each appointment
- Multi-session packages: sell, track sessions used and remaining, and deduct a session on each completed visit
- Payments: cash in USD or LBP, with the exchange rate recorded for each LBP payment
- Exchange rate settings with history
- Automated WhatsApp reminders: appointment reminders, follow-ups, and package renewals
- Message log showing what was sent and its delivery status
- Dashboard: today's appointments, follow-ups due, and today's revenue in USD
- Client import from a spreadsheet (CSV)

### Out of scope (MVP)

- Online booking by clients (through Instagram or a booking link)
- Client portal or app
- Staff accounts and roles
- Multiple branches
- Offline mode
- Before-and-after photos
- Inventory and product stock
- Accounting, tax reports, or a ledger
- Arabic interface

## 6. Key features

**Client management.** Each client has one profile, identified by phone number. The profile shows visit history, package balances, payments, notes, and reminder history.

**Calendar.** The owner books appointments by service and time slot. The system rejects any booking that overlaps an active appointment. Cancelled and no-show appointments free their slot.

**Packages.** Clients buy a package of several sessions for one service. Each completed visit uses one session. Two visits can't use the same session, and a visit is refused when no sessions remain.

**Payments.** Each payment records the amount, the currency, the exchange rate used (for LBP), and the USD equivalent. Mistakes are corrected by voiding the payment, never by deleting it.

**Follow-ups and reminders.** The system schedules reminders when something happens: a booking, a completed visit, or a package sale. A daily job sends what is due through WhatsApp using approved templates. Clients who haven't consented, or who have opted out, are never messaged.

**Dashboard.** Today's appointments, upcoming follow-ups, package renewals due, and today's revenue.

## 7. Constraints

- **One location** at launch.
- **English** interface.
- **Devices:** laptop, tablet, and phone, from one responsive web app.
- **Connectivity:** the clinic's internet is reliable, so the app is online-only.
- **Currency:** USD is the base currency. Clients pay in cash in USD or LBP.
- **Platforms:** frontend on Vercel, API on Vercel serverless functions, data and login on Supabase Cloud.
- **WhatsApp:** automated messages require Meta Business verification and approved message templates.
- **Team:** one developer.

## 8. Success metrics (proposed, to confirm with the owner)

| Metric | Target |
|---|---|
| Double-bookings after launch | 0 |
| Reminders sent on schedule | At least 95% |
| Repeat visits within the expected interval | Set a baseline in the first month, then improve it |
| New bookings made through the system | All of them, within 4 weeks of launch |

## 9. Assumptions

- The owner is the only user at launch.
- Most clients have WhatsApp on their phone number.
- The owner can provide the existing client list, the service list, and current prices.
- All bookings go on a single calendar, not separate calendars per practitioner.
- The clinic has a dedicated phone number for its WhatsApp Business account.

## 10. Open questions

1. Will more than one person take bookings or treat clients within the next six months? This decides when staff accounts are needed.
2. Should a no-show use up a package session?
3. How long should treatment notes and photos be kept?
4. Should the system record deposits on appointments?
5. Do packages ever cover more than one service?
6. Do any appointments combine two services in one visit?
7. Does the owner want a branded name for the system?

## 11. Related documents

- [02-plan.md](02-plan.md): delivery phases, timeline, and risks
- [03-architecture.md](03-architecture.md): system design and architecture decisions
- [04-database.md](04-database.md): data model and schema
