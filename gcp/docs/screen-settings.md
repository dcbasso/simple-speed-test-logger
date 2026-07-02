# Screen: Settings

## Purpose

Allow adjusting internet monitor parameters without editing files or redeploying code. Settings are saved in Firestore and read by the Cloud Function on each execution.

---

## Layout

```
┌──────────────────────────────────────────────────────────────┐
│ speedtest-logger         [Dashboard] [Incidents] [Settings] │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Monitor Settings                                            │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Status Check                                          │  │
│  │                                                        │  │
│  │  Check interval (minutes)                              │  │
│  │  [  15  ]                                              │  │
│  │  Minimum: 5 min   Maximum: 60 min                     │  │
│  │                                                        │  │
│  │  Threshold to consider internet down (minutes)         │  │
│  │  [  45  ]                                              │  │
│  │  Must be greater than the check interval               │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Email Notifications                                   │  │
│  │                                                        │  │
│  │  Destination email                                     │  │
│  │  [  youremail@gmail.com                   ]            │  │
│  │                                                        │  │
│  │  [ ] Send email when outage is detected                │  │
│  │  [ ] Send email when internet recovers                 │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│                              [Cancel]  [Save]               │
│                                                              │
│  Last updated: 06/22/2026 at 13:45                          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Angular Components

| Component | Library | Detail |
|---|---|---|
| Navbar | `mat-toolbar` | |
| "Status Check" section | `mat-card` | Groups interval and threshold fields |
| Interval field | `mat-form-field` + `input[type=number]` | Validation: min 5, max 60 |
| Threshold field | `mat-form-field` + `input[type=number]` | Validation: must be > interval |
| "Notifications" section | `mat-card` | Groups email and toggles |
| Email field | `mat-form-field` + `input[type=email]` | Email format validation |
| Outage toggle | `mat-slide-toggle` | Enables/disables outage alert |
| Recovery toggle | `mat-slide-toggle` | Enables/disables recovery alert |
| Save button | `mat-raised-button` color="primary" | Disabled if form is invalid |
| Cancel button | `mat-button` | Restores current values from Firestore |
| Last updated | `<p>` | Displays `updated_at` from the document |

---

## Form Validations

| Field | Rule |
|---|---|
| Check interval | Required, integer, between 5 and 60 |
| Outage threshold | Required, integer, greater than interval |
| Email | Required, valid email format |

The "Save" button remains disabled while the form is invalid or has no changes.

---

## Save Behavior

1. Validates the form (Angular Reactive Forms)
2. Shows spinner on the "Save" button
3. Writes to Firestore `monitor_config/current`:
   ```json
   {
     "check_interval_minutes": 15,
     "max_minutes_without_data": 45,
     "alert_email": "youremail@gmail.com",
     "notify_on_down": true,
     "notify_on_recovery": true,
     "updated_at": "<Timestamp>"
   }
   ```
4. Shows `mat-snack-bar` success: _"Settings saved successfully"_
5. Updates the "Last updated" field

On error: `mat-snack-bar` with error message.

---

## Load Behavior

1. On screen entry: fetches `monitor_config/current` from Firestore
2. Populates the form with current values
3. If the document does not exist (first time): uses default values

| Field | Default value |
|---|---|
| check_interval_minutes | 15 |
| max_minutes_without_data | 45 |
| alert_email | `environment.allowedEmail` |
| notify_on_down | true |
| notify_on_recovery | true |

---

## Firestore Data

**Collection**: `monitor_config`
**Document**: `current`

Read on screen entry. Written on "Save" click.

The Cloud Function reads this document at the start of each execution to obtain `max_minutes_without_data`, `alert_email`, `notify_on_down`, and `notify_on_recovery`.

> The `check_interval_minutes` field is informational in the dashboard — the actual Cloud Scheduler interval must be adjusted manually in the GCP Console or via Terraform, as the Scheduler cannot be dynamically reconfigured through Firestore.

---

## Screen States

| State | Display |
|---|---|
| Loading config | Skeleton in fields |
| Form unchanged | "Save" button disabled |
| Form invalid | Inline errors in fields + button disabled |
| Saving | Spinner on button, fields disabled |
| Save successful | Green `mat-snack-bar` |
| Save error | Red `mat-snack-bar` |
