# Beauty Clinic CRM: Design system

| | |
|---|---|
| **Status** | In use |
| **Last updated** | 2026-11-19 |
| **Related** | [03-architecture.md](03-architecture.md), [README.md](../README.md) |

## 1. Goals

The people using this app are busy and are often at a desk with a client in front of them. The design aims for:

- **Calm and trustworthy.** A clinical, uncluttered look with warm neutrals and one brand colour, so money and health information feel handled with care.
- **Few steps to the common jobs.** Book, complete, take a payment and add a note are each reachable in a click or two from where the person already is.
- **Readable everywhere.** Phone, tablet and laptop, in a bright room or a dim one, in light mode or dark.

## 2. Workflow principles

1. **One obvious next step.** Each screen has a single primary action, drawn in the brand colour.
2. **Book from anywhere.** "New appointment" lives in the sidebar (and the top bar on phones). It opens the same dialog from any screen, and from a client's page it already knows the client.
3. **Start from today.** The home screen is the day's schedule, with the next appointment highlighted and quick actions below.
4. **Open, act, close.** An appointment opens in a dialog with its next step first (Complete visit), then payment and notes. Nobody has to leave the calendar.
5. **Organise long pages.** A client has tabs (Visits, Packages and payments, Profile) instead of one long scroll.
6. **Confirm what hurts, not what helps.** Cancelling, no-shows, deactivating and voiding ask first, in place. Saving does not.
7. **Say what happened.** A short toast confirms a save. Errors appear next to the thing that failed, in plain words, with what to do.
8. **Never show a blank screen.** Loading uses placeholders shaped like the content. Empty lists explain themselves and offer the next step.
9. **Show only what the person can use.** The menu follows their permissions. The API enforces the same rules.

## 3. Colour

Colours are defined once as tokens in [apps/web/src/app/globals.css](../apps/web/src/app/globals.css), each with a light and a dark value. Components use token names (`bg-surface`, `text-muted`, `bg-ok-soft text-ok-ink`) and never raw colours, so every screen themes itself and dark mode needs no extra code.

| Token | Role | Light | Dark |
|---|---|---|---|
| `canvas` | Page background | `#f6f5f2` | `#0d1110` |
| `surface` | Cards, inputs, menus | `#ffffff` | `#151a19` |
| `sunken` | Wells, table headers, hover | `#efede8` | `#1c2322` |
| `line` / `line-strong` | Dividers / control borders | `#e3e0d8` / `#8f8b82` | `#2a3331` / `#6a7674` |
| `fg` | Body text | `#1c1b19` | `#e8ecea` |
| `muted` / `faint` | Secondary text / hints and placeholders | `#66635d` / `#6c685f` | `#98a4a1` / `#8b9795` |
| `primary` | Brand teal: main actions, links, focus | `#0f766e` | `#2dd4bf` |
| `accent` | Rose, used sparingly for warmth | `#b4536a` | `#e58ca0` |
| `ok`, `warn`, `bad`, `info` | Status colours, each with `-soft` and `-ink` | green, amber, red, blue | lighter tints |

Status colours always travel in pairs: a soft background with an "ink" text colour (`bg-ok-soft text-ok-ink`), and a label, so meaning never depends on colour alone.

### Measured contrast

These were calculated from the token values, not judged by eye.

| Pair | Light | Dark | Needs |
|---|---|---|---|
| Body text on page and cards | 15.8 to 17.2 | 14.8 to 16.0 | 4.5 |
| Secondary text on page, cards and wells | 5.1 to 6.0 | 6.2 to 7.4 | 4.5 |
| Hints and placeholders on page, cards, wells | 4.7 to 5.5 | 5.3 to 6.3 | 4.5 |
| Text on the primary button | 5.5 | 9.1 | 4.5 |
| Status text on its soft background | 6.4 to 8.2 | 8.1 to 10.2 | 4.5 |
| Primary colour on cards (links, icons) | 5.5 | 9.5 | 3 |
| Input and control borders on cards | 3.4 | 3.7 | 3 |

If a token changes, re-check the pairs above before shipping it.

## 4. Type and space

- **Font:** Inter, loaded with `next/font`, falling back to the system font. Base size 15px.
- **Scale:** page titles 24px semibold, section headings 16px semibold, body 14 to 15px, hints 12px. Tight tracking on large numbers.
- **Space:** a 4px grid. Cards use 16 to 24px padding. Pages have 16px side margins on phones and up to 40px on desktop, with a 1152px content width.
- **Shape:** 8px radius on controls, 12px on cards, 16px on dialogs. Soft shadows in light mode, hairline rings in dark.

## 5. Components

All in [apps/web/src/components](../apps/web/src/components), and [ui.tsx](../apps/web/src/components/ui.tsx) holds the basic ones:

- **Actions:** `Button` (primary, secondary, ghost, danger; with loading state), `LinkButton`, `IconButton`.
- **Forms:** `Field` (label, hint and error in one), `Input`, `Select`, `Textarea`, `Checkbox`, `Segmented`.
- **Surfaces and structure:** `Card`, `PageHeader` (title, description, actions, back link), `SectionHeading`, `Tabs`, `Modal`.
- **Feedback:** `Alert`, `Badge`, `Toast`, `Skeleton`, `ListSkeleton`, `Spinner`, `EmptyState`.
- **Identity:** `Avatar` (initials on a stable tint), `BrandMark`.
- **Shell:** `AppShell` (sidebar on desktop, drawer on phones), `AuthLayout`, `ThemeToggle`, `BookingProvider`.

Adding a screen: use `PageHeader`, build with `Card` and `Field`, pick colours only from tokens, give it a skeleton and an `EmptyState`, and confirm saves with a toast.

## 6. Themes

- Three choices: Light, Dark, or Match device. The choice is kept on that device.
- A small script in the page head applies the theme before the first paint, so there is no flash of the wrong one.
- While following the device, the app switches live when the device does.
- Pickers for dates and times follow the theme too.

## 7. Accessibility

- Every text and control colour pair meets WCAG AA (section 3).
- One clear focus ring (2px teal, offset) on every interactive element.
- Every input has a visible label. Errors are announced (`role="alert"`), and live totals use `aria-live`.
- Dialogs trap focus, close with Escape, return focus to where they were opened, and stop the page behind from scrolling.
- A "Skip to content" link, one `h1` per page, and landmarks for navigation and the main area.
- Motion is switched off for people who ask their device to reduce it.
- The calendar's appointments are buttons with a full spoken description (who, what, when, status, package).

## 8. Reviewing a screen

```
npm run preview -w @deeclinic/web
```

Opens the app at `http://localhost:3100` against a fake API with sample data and **no login**, in its own build folder so it can run next to the normal dev server. It is for design review only: the login bypass is ignored in production builds. The sample data lives in [apps/web/design-preview/mock-api.cjs](../apps/web/design-preview/mock-api.cjs); add to it when a new screen needs data.

Check each new screen in light and dark, at phone width (about 390px) and desktop width, before it ships.

## 9. Known limits

- Date and time inputs use the browser's own pickers, so the format follows the person's device (for example 12-hour time).
- The calendar shows 07:00 to 22:00. Appointments outside that are clipped.
- Icons are a small built-in set. Anything new needs a path added in `Icon.tsx`.
