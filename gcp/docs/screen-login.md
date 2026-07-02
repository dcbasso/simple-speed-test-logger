# Screen: Login

## Purpose

Authenticate the user via Google Sign-In and ensure only the authorized email has access to the dashboard.

---

## Layout

```
┌─────────────────────────────────────────┐
│                                         │
│         speedtest-logger                │
│         Internet Monitor                │
│                                         │
│   ┌─────────────────────────────────┐   │
│   │  G  Sign in with Google         │   │
│   └─────────────────────────────────┘   │
│                                         │
│   [error message, if any]               │
│                                         │
└─────────────────────────────────────────┘
```

---

## Components

| Element | Angular Type | Detail |
|---|---|---|
| Logo / title | static `<h1>` | App name |
| Google button | `mat-raised-button` | Google icon + "Sign in with Google" text |
| Error message | `mat-error` or conditional `<p>` | Shown only if there is an error |

---

## Behavior

1. User clicks "Sign in with Google"
2. Firebase opens the Google account selection popup
3. After successful authentication:
   - Checks if `user.email === environment.allowedEmail`
   - **If yes**: redirects to `/dashboard`
   - **If no**: calls `signOut()` immediately and displays error: _"Access denied. This account is not authorized."_
4. If the popup is closed without login: no action

## Loading State

- While the popup is open: button is disabled with spinner
- If an active session already exists (page refresh): redirects directly to `/dashboard` without showing the login screen

## Route Guard

`AuthGuard` protects all routes except `/login`. Redirects to `/login` if not authenticated.

---

## Firestore Data

None. The login screen does not consume Firestore.

---

## Required Environment Variables

```typescript
// environment.ts
export const environment = {
  allowedEmail: 'youremail@gmail.com',
  firebase: { /* Firebase config */ }
};
```
