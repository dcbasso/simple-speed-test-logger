# Project Conventions — speedtest-logger GCP

## Language

All code must be written in English:
- Variable names, function names, class names, constants
- Code comments and documentation
- Commit messages
- File names

Exception: user-facing UI strings are managed via i18n files (see Internationalization section).

---

## Documentation

Every method, function, and public type must have documentation. No exceptions.

### Rust — rustdoc
```rust
/// Appends a speedtest result document to Firestore.
///
/// # Arguments
/// * `config` - Firestore connection settings (project ID, collection)
/// * `token` - OAuth2 bearer token obtained from Service Account
/// * `result` - Parsed speedtest measurement to persist
///
/// # Errors
/// Returns an error if the HTTP request fails or Firestore rejects the document.
pub async fn append_document(config: &FirestoreConfig, token: &str, result: &SpeedtestResult) -> Result<()> {
```

### Python — Google-style docstrings
```python
def check_internet_status(request) -> tuple[str, int]:
    """Check whether recent speedtest data exists and send alert emails if needed.

    Reads the latest document from Firestore, compares its timestamp against
    the configured threshold, and sends a Gmail alert on state transitions
    (down → up or up → down).

    Args:
        request: HTTP request object provided by Cloud Functions runtime.

    Returns:
        A tuple of (response_body, http_status_code).
    """
```

### TypeScript/Angular — JSDoc
```typescript
/**
 * Fetches speedtest results from Firestore within the given time range.
 *
 * @param startDate - Start of the query window (inclusive)
 * @param endDate - End of the query window (inclusive)
 * @returns Observable that emits an array of SpeedtestResult ordered by timestamp ascending
 */
getResults(startDate: Date, endDate: Date): Observable<SpeedtestResult[]> {
```

---

## Clean Code

- Functions do one thing. If a function needs a comment explaining what it does, split it.
- No magic numbers — use named constants.
- No dead code — remove unused variables, imports, and methods.
- Prefer explicit over clever.
- Keep functions short. If a function exceeds ~30 lines, consider extracting logic.
- No commented-out code in commits.

---

## Angular — Screen Structure

Each screen is a **standalone component** with its own folder under `features/`. No shared modules.

```
features/
├── login/
│   ├── login.component.ts
│   ├── login.component.html
│   └── login.component.scss
├── dashboard/
│   ├── dashboard.component.ts
│   ├── dashboard.component.html
│   ├── dashboard.component.scss
│   └── components/             # sub-components used only by this screen
│       ├── speed-chart/
│       ├── metrics-cards/
│       └── date-range-filter/
├── incidents/
│   ├── incidents.component.ts
│   ├── incidents.component.html
│   ├── incidents.component.scss
│   └── components/
│       └── incident-list/
└── settings/
    ├── settings.component.ts
    ├── settings.component.html
    └── settings.component.scss
```

Routes are lazy-loaded:
```typescript
// app.routes.ts
{
  path: 'dashboard',
  loadComponent: () => import('./features/dashboard/dashboard.component')
    .then(m => m.DashboardComponent),
  canActivate: [authGuard]
}
```

---

## Internationalization (i18n)

The UI must support two languages: **Portuguese (pt-BR)** and **English (en)**.

- Library: **ngx-translate** (`@ngx-translate/core` + `@ngx-translate/http-loader`)
- Translation files in `src/assets/i18n/`:
  - `pt-BR.json` — default language
  - `en.json`

All user-facing strings must use the translate pipe or service. No hardcoded strings in templates or components.

```html
<!-- Template -->
<h1>{{ 'DASHBOARD.TITLE' | translate }}</h1>
<mat-label>{{ 'SETTINGS.CHECK_INTERVAL' | translate }}</mat-label>
```

```typescript
// Component
this.snackBar.open(this.translate.instant('COMMON.SAVE_SUCCESS'), '', { duration: 3000 });
```

Translation key structure:
```json
{
  "COMMON": { "SAVE": "Save", "CANCEL": "Cancel", "LOADING": "Loading..." },
  "LOGIN": { "TITLE": "Internet Monitor", "BUTTON": "Sign in with Google" },
  "DASHBOARD": { "TITLE": "Dashboard", "NO_DATA": "No records found for this period" },
  "INCIDENTS": { "TITLE": "Incidents", "NO_INCIDENTS": "No incidents found — all good!" },
  "SETTINGS": { "TITLE": "Settings", "SAVE_SUCCESS": "Settings saved successfully" }
}
```

Language preference is persisted in `localStorage`. A language selector is shown in the navbar.

---

## Theming (Light / Dark)

Angular Material custom themes with CSS custom properties. Two themes defined in `styles.scss`.

- Default: follows system preference via `prefers-color-scheme`
- User can override via toggle in the navbar
- Preference persisted in `localStorage`

```scss
// styles.scss
@use '@angular/material' as mat;

$light-theme: mat.define-theme((color: (theme-type: light, primary: mat.$blue-palette)));
$dark-theme:  mat.define-theme((color: (theme-type: dark,  primary: mat.$blue-palette)));

:root { @include mat.all-component-themes($light-theme); }

.dark-theme { @include mat.all-component-themes($dark-theme); }
```

```typescript
// theme.service.ts
/** Toggles between light and dark theme and persists the preference. */
toggleTheme(): void {
  this.isDark = !this.isDark;
  document.body.classList.toggle('dark-theme', this.isDark);
  localStorage.setItem('theme', this.isDark ? 'dark' : 'light');
}
```

---

## Summary Table

| Rule | Applies to |
|---|---|
| All code in English | Rust, Python, TypeScript |
| JSDoc / rustdoc / docstrings on every method | Rust, Python, TypeScript |
| Clean code (single responsibility, no magic numbers, no dead code) | All |
| Standalone components, one folder per screen | Angular |
| Lazy-loaded routes | Angular |
| ngx-translate, pt-BR + en | Angular |
| Angular Material theming, light + dark | Angular |
| Theme and language persisted in localStorage | Angular |
