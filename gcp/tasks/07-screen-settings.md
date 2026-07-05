# Task 07: Screen — Settings

## Context
Allows the owner to configure monitor parameters (check threshold, alert email, notification toggles)
without editing files or redeploying. Settings are read from and written to `monitor_config/current`
in Firestore. The Cloud Function reads this document at every execution.

## Goal
Implement `gcp/server/web/src/app/features/settings/` with a reactive form that loads current
config from Firestore and saves changes back.

## Acceptance Criteria
- [x] Form loads with current values from `monitor_config/current` on entry
- [x] If document does not exist, form loads with default values
- [x] "Save" button is disabled when form is pristine or invalid
- [x] "Cancel" restores the last saved values (no Firestore read — use in-memory snapshot)
- [x] Saving writes to `monitor_config/current` and shows success snackbar
- [x] Error on save shows error snackbar
- [x] Spinner shown on button while saving; fields disabled during save
- [x] `max_minutes_without_data` validation: must be greater than `check_interval_minutes`
- [x] "Last updated" shows `updated_at` timestamp after save
- [x] All strings use `translate` pipe
- [x] Works in both light and dark theme
- [x] Component and all methods have JSDoc
- [x] Code in English

## Technical Notes

### Form structure (Angular Reactive Forms)
```typescript
form = fb.group({
  check_interval_minutes:    [15,  [Validators.required, Validators.min(5), Validators.max(60)]],
  max_minutes_without_data:  [45,  [Validators.required]],
  alert_email:               ['',  [Validators.required, Validators.email]],
  notify_on_down:            [true],
  notify_on_recovery:        [true],
});
```

Add a cross-field validator: `max_minutes_without_data > check_interval_minutes`.

### Firestore document written on save
```typescript
// monitor_config/current
{
  check_interval_minutes: number,
  max_minutes_without_data: number,
  alert_email: string,
  notify_on_down: boolean,
  notify_on_recovery: boolean,
  updated_at: serverTimestamp()
}
```

### Default values (when document does not exist)
```typescript
const DEFAULTS = {
  check_interval_minutes: 15,
  max_minutes_without_data: 45,
  alert_email: environment.allowedEmail,
  notify_on_down: true,
  notify_on_recovery: true,
};
```

### Note on Cloud Scheduler interval
Display a `mat-hint` below the `check_interval_minutes` field explaining that changing this
value does not automatically update Cloud Scheduler — that must be done manually in GCP Console
or via Terraform. The field is still useful as documentation of the intended interval.

## i18n keys needed
```json
{
  "SETTINGS": {
    "TITLE": "Settings",
    "SECTION_CHECK": "Status Check",
    "FIELD_INTERVAL": "Check interval (minutes)",
    "FIELD_INTERVAL_HINT": "Changing this does not update Cloud Scheduler automatically.",
    "FIELD_THRESHOLD": "Minutes without data to trigger alert",
    "THRESHOLD_ERROR": "Must be greater than the check interval.",
    "SECTION_EMAIL": "Email Notifications",
    "FIELD_EMAIL": "Alert email address",
    "FIELD_NOTIFY_DOWN": "Send alert when internet goes down",
    "FIELD_NOTIFY_RECOVERY": "Send alert when internet recovers",
    "SAVE": "Save",
    "CANCEL": "Cancel",
    "SAVE_SUCCESS": "Settings saved successfully.",
    "SAVE_ERROR": "Failed to save settings. Please try again.",
    "LAST_UPDATED": "Last updated"
  }
}
```

## References
- `gcp/docs/screen-settings.md` — full layout, validation rules, behavior on save/cancel
- `gcp/architecture.md` — `monitor_config` collection schema
- `gcp/CLAUDE.md` — conventions

## Definition of Done
Navigating to `/settings` shows current Firestore values (or defaults). Editing and saving
updates the document in Firestore (visible in GCP Console). Validation errors appear inline.
Snackbar confirms success or error. Cancel restores previous values without a Firestore read.
