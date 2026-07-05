# Task 04: Screen — Login

## Context
Task 03 created a placeholder login component. This task implements the full login screen
with Google Sign-In button, loading state, error display, and the single-user access restriction.

## Goal
Implement `gcp/server/web/src/app/features/login/login.component.ts` (and template/styles)
as described in the screen spec.

## Acceptance Criteria
- [x] Screen displays app title and "Sign in with Google" button
- [x] Button is disabled with spinner while the Google popup is open
- [x] Successful login with allowed email redirects to `/dashboard`
- [x] Login with any other email shows error message; user stays on `/login`
- [x] If user is already authenticated (page refresh), redirects immediately to `/dashboard`
- [x] All strings use `translate` pipe — no hardcoded text in template
- [x] Works correctly in both light and dark theme
- [x] Component and all methods have JSDoc
- [x] Code is in English

## Technical Notes
- Delegate all auth logic to `AuthService` (created in task 03) — component only calls and reacts
- Use `mat-raised-button` with Google icon for the sign-in button
- Error message displayed via conditional `<p>` or `mat-error` below the button
- No form — single button only

## i18n keys needed
```json
{
  "LOGIN": {
    "TITLE": "speedtest-logger",
    "SUBTITLE": "Internet Monitor",
    "BUTTON": "Sign in with Google",
    "ERROR_DENIED": "Access denied. This account is not authorized.",
    "ERROR_GENERIC": "Authentication failed. Please try again."
  }
}
```

## References
- `gcp/docs/screen-login.md` — full layout, behavior, and component spec
- `gcp/CLAUDE.md` — conventions
- `src/app/core/auth.service.ts` — created in task 03

## Definition of Done
Navigating to `/login` shows the screen. All acceptance criteria above pass manually.
