# Task 06: Screen — Incidents

## Context
Displays the history of internet outages recorded by the Cloud Function in the `incidents`
Firestore collection. Each incident has a start time, optional recovery time, and duration.
An ongoing incident (no `recovered_at`) is highlighted and shows an "Ongoing" badge.

## Goal
Implement `gcp/server/web/src/app/features/incidents/` including the main component and
its sub-components (summary cards, incident table).

## Acceptance Criteria
- [x] Screen loads with "Last 30 days" selected by default
- [x] Summary cards show total incident count and total offline time for the selected period
- [x] Table shows all incidents: start, end (or "Ongoing" badge), duration
- [x] Ongoing incident row is highlighted in light red (both themes)
- [x] Table is paginated (10 rows per page) with `mat-paginator`
- [x] Default sort is `started_at DESC` (most recent first)
- [x] Period filter uses same presets as Dashboard
- [x] Loading, empty, and error states handled
- [x] All strings use `translate` pipe
- [x] Works in both light and dark theme
- [x] All components and methods have JSDoc
- [x] Code in English

## Technical Notes

### Sub-components inside `features/incidents/components/`
- `incident-list/` — `mat-table` + `mat-paginator`, receives `Incident[]`

### Firestore query
```typescript
collection('incidents'),
where('started_at', '>=', startDate),
where('started_at', '<=', endDate),
orderBy('started_at', 'desc')
```

### Incident interface
```typescript
interface Incident {
  id: string;
  started_at: Timestamp;
  recovered_at: Timestamp | null;
  duration_minutes: number | null;
}
```

### Total offline time calculation
Sum `duration_minutes` of all incidents where `recovered_at != null`.
Format as `Xh XXmin` (e.g. `1h 23min`). Show `—` if no completed incidents.

### "Ongoing" highlight
Apply a CSS class `incident-ongoing` to the row when `recovered_at === null`.
In light theme: `background: #fff3f3`. In dark theme: `background: #3d1a1a`.

## i18n keys needed
```json
{
  "INCIDENTS": {
    "TITLE": "Incidents",
    "NO_INCIDENTS": "No incidents found — all good!",
    "TOTAL_INCIDENTS": "Total incidents",
    "TOTAL_OFFLINE": "Total offline time",
    "COL_INDEX": "#",
    "COL_START": "Start",
    "COL_END": "End",
    "COL_DURATION": "Duration",
    "ONGOING": "Ongoing"
  }
}
```

## References
- `gcp/docs/screen-incidents.md` — full layout, table columns, card calculations
- `gcp/architecture.md` — `incidents` collection schema
- `gcp/CLAUDE.md` — conventions

## Definition of Done
Navigating to `/incidents` shows real incident data from Firestore. An ongoing incident
(if any) appears highlighted with the "Ongoing" badge. Pagination works. Both themes render correctly.
