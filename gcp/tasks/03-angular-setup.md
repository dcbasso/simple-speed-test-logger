# Task 03: Angular Project Setup

## Context
Before any screen can be implemented, the Angular project must be scaffolded with all
shared infrastructure in place: Firebase SDK, Authentication, Firestore client, i18n (ngx-translate),
Angular Material theming (light/dark), routing with lazy-loaded routes, and the AuthGuard.
This task is a prerequisite for tasks 04–07.

## Goal
Create a working Angular 18+ SPA at `gcp/server/web/` that boots, shows the login screen,
and has all shared services and configuration ready for screen implementation.

## Acceptance Criteria
- [ ] `ng serve` runs without errors
- [ ] `ng build` produces a production build without errors
- [ ] Firebase Auth is configured — Google Sign-In popup works in the browser
- [ ] Login with the allowed email redirects to `/dashboard` (placeholder page is fine)
- [ ] Login with any other email is rejected and shows an error message
- [ ] Language defaults to pt-BR; switching to English updates all translated strings
- [ ] Light/dark theme toggle works; preference persists across page refreshes
- [ ] `AuthGuard` blocks unauthenticated access to all routes except `/login`
- [ ] All services and guards have JSDoc on every method
- [ ] All code in English; all UI strings use translate pipe (no hardcoded strings)

## Technical Notes

### Scaffold command (run from `gcp/server/`)
```bash
ng new web --standalone --routing --style=scss --skip-git
cd web
ng add @angular/material
ng add @angular/fire
npm install @ngx-translate/core @ngx-translate/http-loader ngx-charts
```

### Key files to create/configure

**`src/app/app.config.ts`** — providers:
- `provideRouter(routes)` with lazy routes
- `provideFirebaseApp(() => initializeApp(environment.firebase))`
- `provideAuth(() => getAuth())`
- `provideFirestore(() => getFirestore())`
- `provideHttpClient()` (required by ngx-translate http loader)
- `TranslateModule.forRoot(...)` with `HttpLoader`

**`src/app/app.routes.ts`**:
```typescript
{ path: 'login',      loadComponent: () => import('./features/login/...')  },
{ path: 'dashboard',  loadComponent: () => import('./features/dashboard/...'), canActivate: [authGuard] },
{ path: 'incidents',  loadComponent: () => import('./features/incidents/...'), canActivate: [authGuard] },
{ path: 'settings',   loadComponent: () => import('./features/settings/...'),  canActivate: [authGuard] },
{ path: '',           redirectTo: 'dashboard', pathMatch: 'full' },
```

**`src/app/core/auth.service.ts`** — methods:
- `signInWithGoogle(): Promise<void>` — signs in, checks email, redirects or rejects
- `signOut(): Promise<void>`
- `currentUser$: Observable<User | null>`

**`src/app/core/auth.guard.ts`** — functional guard using `currentUser$`

**`src/app/core/theme.service.ts`** — methods:
- `initTheme(): void` — reads localStorage on app start
- `toggleTheme(): void` — switches class on `document.body`, persists to localStorage
- `isDark$: Observable<boolean>`

**`src/assets/i18n/pt-BR.json`** and **`en.json`** — translation keys for all shared strings:
```json
{
  "COMMON": { "SAVE": "...", "CANCEL": "...", "LOADING": "..." },
  "NAV": { "DASHBOARD": "...", "INCIDENTS": "...", "SETTINGS": "..." },
  "LOGIN": { "TITLE": "...", "SUBTITLE": "...", "BUTTON": "...", "ERROR_DENIED": "..." }
}
```

**`src/environments/environment.ts`** and **`environment.prod.ts`**:
```typescript
export const environment = {
  allowedEmail: 'youremail@gmail.com',
  firebase: { apiKey: '...', authDomain: '...', projectId: '...', ... }
};
```

### Theme implementation
Apply `.dark-theme` class to `document.body`. Angular Material theme defined in `styles.scss`
using `mat.define-theme()` for both light and dark variants.

### Folder structure to create
```
src/app/
├── app.config.ts
├── app.routes.ts
├── core/
│   ├── auth.service.ts
│   ├── auth.guard.ts
│   ├── theme.service.ts
│   └── firestore.service.ts   ← base service with typed Firestore helpers
└── features/
    ├── login/
    │   └── login.component.ts  ← placeholder until task 04
    ├── dashboard/
    │   └── dashboard.component.ts
    ├── incidents/
    │   └── incidents.component.ts
    └── settings/
        └── settings.component.ts
```

## References
- `gcp/architecture.md` — Firebase config, allowedEmail, theming decisions
- `gcp/CLAUDE.md` — all conventions (standalone, lazy routes, i18n, theming)
- `gcp/docs/pre-requisites.md` Step 8 — where to get `firebaseConfig`

## Definition of Done
`ng serve` works. Navigating to `http://localhost:4200` redirects to `/login`.
Clicking "Sign in with Google" and authenticating with the allowed email reaches `/dashboard`.
Authenticating with a different email shows the error message and stays on `/login`.
Theme toggle and language switcher both work and persist on refresh.
