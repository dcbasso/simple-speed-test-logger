# Screen: Incidents

## Purpose

Display the history of internet outages detected by the monitor, with the start, end, and duration of each incident.

---

## Layout

```
┌──────────────────────────────────────────────────────────────┐
│ speedtest-logger         [Dashboard] [Incidents] [Settings] │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Period: [Last 30 days ▼]                   [Apply]         │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  ┌───────────────────┐  ┌───────────────────┐               │
│  │  Total incidents  │  │ Total offline time │               │
│  │        X          │  │     Xh XXmin       │               │
│  └───────────────────┘  └───────────────────┘               │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  #  │  Start                │  End                  │ Duration│
│ ────┼───────────────────────┼───────────────────────┼──────── │
│  1  │  06/22/2026 13:30     │  06/22/2026 14:15     │ 45 min  │
│  2  │  06/20/2026 08:00     │  06/20/2026 08:52     │ 52 min  │
│  3  │  06/18/2026 21:10     │  Ongoing...           │  —      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Angular Components

| Component | Library | Detail |
|---|---|---|
| Navbar | `mat-toolbar` | |
| Period filter | `mat-select` + `mat-datepicker` | Same presets as Dashboard |
| Summary cards | `mat-card` | Total incidents + total offline time |
| Incident table | `mat-table` | Pagination with `mat-paginator` |
| "Ongoing" badge | `mat-chip` red | When `recovered_at == null` |

---

## Period Filter

Same presets as Dashboard (6h, 24h, 7d, 30d, Custom). Filters by `started_at` within the range.

---

## Summary Cards

| Card | Calculation |
|---|---|
| Total incidents | `count` of returned documents |
| Total offline time | sum of `duration_minutes` (ignores ongoing incidents) |

---

## Table

| Column | Firestore Field | Format |
|---|---|---|
| # | — | sequential index (1, 2, 3…) |
| Start | `started_at` | `MM/dd/yyyy HH:mm` (local timezone) |
| End | `recovered_at` | `MM/dd/yyyy HH:mm` or "Ongoing" badge |
| Duration | `duration_minutes` | `Xh XXmin` or `—` if ongoing |

Default sort: `started_at DESC` (most recent first).

Pagination: 10 items per page.

---

## Firestore Data

**Collection**: `incidents`
**Query**:
```
where started_at >= startDate
where started_at <= endDate
orderBy started_at DESC
```

---

## Who creates incident documents?

The **Cloud Function** (`check-internet-status`):
- On outage detection: creates a document with `started_at = now`, `recovered_at = null`
- On recovery detection: updates the most recent document with `recovered_at = now` and `duration_minutes = diff`

---

## Screen States

| State | Display |
|---|---|
| Loading | Spinner in table |
| No incidents in range | Message: "No incidents found — all good!" |
| Ongoing incident | Row highlighted in light red with "Ongoing" badge |
| Firestore error | `mat-snack-bar` with error message |
