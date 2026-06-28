# Screen: Dashboard

## Purpose

Display the speed measurement history with charts and aggregated metrics, filtered by date range.

---

## Layout

```
┌──────────────────────────────────────────────────────────────┐
│ speedtest-logger         [Dashboard] [Incidents] [Settings] │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Period: [Last 24h ▼]  From: [__/__/____] To: [__/__/____]  │
│                                                 [Apply]     │
├──────────────────────────────────────────────────────────────┤
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐         │
│  │ Download avg │ │  Upload avg  │ │   Ping avg   │         │
│  │  XX.X Mbps  │ │  XX.X Mbps  │ │    XX ms     │         │
│  └──────────────┘ └──────────────┘ └──────────────┘         │
│  ┌──────────────┐ ┌──────────────┐                          │
│  │  Jitter avg  │ │ Packet Loss  │                          │
│  │    X.X ms   │ │    X.XX %    │                          │
│  └──────────────┘ └──────────────┘                          │
├──────────────────────────────────────────────────────────────┤
│  Download & Upload (Mbps)                                    │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  [line chart — download blue, upload green]           │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  Ping & Jitter (ms)                                          │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  [line chart — ping orange, jitter gray]              │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  Packet Loss (%)                                             │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  [bar chart — red when > 0]                           │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## Angular Components

| Component | Library | Detail |
|---|---|---|
| Navbar | `mat-toolbar` | Links to other screens |
| Period filter | `mat-select` + `mat-datepicker` | Presets: 6h, 24h, 7d, 30d, Custom |
| Metric cards | `mat-card` | 5 cards: download, upload, ping, jitter, packet loss |
| Download/upload chart | `ngx-charts-line-chart` | Two series, X axis = time |
| Ping/jitter chart | `ngx-charts-line-chart` | Two series |
| Packet loss chart | `ngx-charts-bar-vertical` | Conditional color (red if > 0) |

---

## Period Filter

| Option | Behavior |
|---|---|
| Last 6h | `now - 6h` to `now` |
| Last 24h | `now - 24h` to `now` (default on open) |
| Last 7 days | `now - 7d` to `now` |
| Last 30 days | `now - 30d` to `now` |
| Custom | Enables From / To fields with datepicker |

Clicking "Apply" (or selecting a preset) reloads Firestore data with the new range.

---

## Card Metrics

Calculated on the frontend from documents returned by the filter:

| Card | Calculation |
|---|---|
| Download avg | mean of `download_mbps` |
| Upload avg | mean of `upload_mbps` |
| Ping avg | mean of `ping_ms` |
| Jitter avg | mean of `jitter_ms` |
| Packet Loss avg | mean of `packet_loss_pct` |

Each card also shows min and max below the average.

---

## Firestore Data

**Collection**: `speedtest_results`
**Query**:
```
where timestamp >= startDate
where timestamp <= endDate
orderBy timestamp ASC
```

The returned documents feed both the cards and the charts.

---

## Screen States

| State | Display |
|---|---|
| Loading | Skeleton in cards and spinner in charts |
| No data in range | Message: "No records found for this period" |
| Firestore error | `mat-snack-bar` with error message |
