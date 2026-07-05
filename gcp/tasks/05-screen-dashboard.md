# Task 05: Screen — Dashboard

## Context
Main screen of the app. Displays speedtest history as line/bar charts and aggregated metric cards,
filtered by a date range selector. Data comes from the `speedtest_results` Firestore collection.

## Goal
Implement `gcp/server/web/src/app/features/dashboard/` including the main component and
its sub-components (date filter, metric cards, charts).

## Acceptance Criteria
- [x] Screen loads with "Last 24h" selected by default
- [x] 5 metric cards show average, min, and max for: download, upload, ping, jitter, packet loss
- [x] 3 charts render correctly: download+upload (line), ping+jitter (line), packet loss (bar)
- [x] Period presets (6h, 24h, 7d, 30d) update data without page reload
- [x] Custom range with datepicker works and triggers data reload on "Apply"
- [x] Loading state shown while Firestore query runs (skeleton cards, spinner on charts)
- [x] Empty state shown when no records exist for selected period
- [x] Error state shown on Firestore failure (snackbar)
- [x] All strings use `translate` pipe
- [x] Works in both light and dark theme
- [x] All components and methods have JSDoc
- [x] Code in English

## Technical Notes

### Sub-components to create inside `features/dashboard/components/`
- `date-range-filter/` — `mat-select` with presets + optional `mat-datepicker` pair
- `metrics-cards/` — receives `SpeedtestResult[]`, computes and displays aggregates
- `speed-chart/` — wraps `ngx-charts-line-chart`, receives typed series data

### Firestore query (via `FirestoreService`)
```typescript
collection('speedtest_results'),
where('timestamp', '>=', startDate),
where('timestamp', '<=', endDate),
orderBy('timestamp', 'asc')
```

### Metric calculation (done in component, not service)
Compute mean, min, max from the result array. Handle empty array gracefully (show `—`).

### Chart data format for ngx-charts
```typescript
[
  { name: 'Download', series: [{ name: date, value: mbps }, ...] },
  { name: 'Upload',   series: [{ name: date, value: mbps }, ...] }
]
```

## i18n keys needed
```json
{
  "DASHBOARD": {
    "TITLE": "Dashboard",
    "PERIOD_LABEL": "Period",
    "APPLY": "Apply",
    "NO_DATA": "No records found for this period",
    "DOWNLOAD_AVG": "Download avg",
    "UPLOAD_AVG": "Upload avg",
    "PING_AVG": "Ping avg",
    "JITTER_AVG": "Jitter avg",
    "PACKET_LOSS": "Packet Loss",
    "CHART_DOWNLOAD_UPLOAD": "Download & Upload (Mbps)",
    "CHART_PING_JITTER": "Ping & Jitter (ms)",
    "CHART_PACKET_LOSS": "Packet Loss (%)"
  }
}
```

## References
- `gcp/docs/screen-dashboard.md` — full layout, component table, filter behavior
- `gcp/architecture.md` — `speedtest_results` collection schema
- `gcp/CLAUDE.md` — conventions
- `src/app/core/firestore.service.ts` — created in task 03

## Definition of Done
Navigating to `/dashboard` shows real data from Firestore. Switching periods updates charts
and cards. Empty and error states display correctly. Both themes render without visual issues.
