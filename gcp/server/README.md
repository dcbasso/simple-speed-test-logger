# speedtest-logger — GCP Server

This directory contains the server-side components of the GCP variant:

| Path | Description |
|---|---|
| `function/` | Python Cloud Function (Gen 2) — internet monitor and alert sender |
| `web/` | Angular SPA — dashboard, incidents, and settings screens |
| `deploy.sh` | Shell script to deploy the Cloud Function and Cloud Scheduler |
| `deploy/` | Local-only folder for credentials and deploy tokens (never committed) |

---

## Prerequisites

Complete all steps in [../docs/pre-requisites.md](../docs/pre-requisites.md) before continuing.
That document covers: GCP project, APIs, Firestore, Firebase Auth, Service Account, Gmail OAuth2, and Firebase web app registration.

---

## 1. Deploy the Cloud Function

### 1.1 — Configure `deploy.sh`

Open `deploy.sh` and set the variables at the top to match your project:

```bash
PROJECT_ID="your-gcp-project-id"
REGION="us-east1"                    # must match the Firestore region you chose
FUNCTION_NAME="check-internet-status"
SA="speedtest-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com"
ALERT_EMAIL="youremail@gmail.com"
FIRESTORE_DATABASE="(default)"       # or the name you gave your database
SCHEDULER_JOB="speedtest-monitor-scheduler"
TIMEZONE="America/Sao_Paulo"         # your local timezone
SCHEDULE="*/15 * * * *"             # how often to check (every 15 min recommended)
```

### 1.2 — Run the deploy script

```bash
bash gcp/server/deploy.sh
```

This will:
- Deploy the Cloud Function (Gen 2, HTTP trigger, no public access)
- Grant the Service Account the invoker role on the function
- Create (or update) the Cloud Scheduler job that calls the function on the configured schedule

### 1.3 — Verify

Trigger a manual run to confirm everything works:

```bash
gcloud scheduler jobs run speedtest-monitor-scheduler \
  --project=YOUR_PROJECT_ID \
  --location=YOUR_REGION
```

Then check Firestore for a new document in the `incidents` collection (if the internet was detected as down) or check your email for an alert.

---

## 2. Deploy the Angular Dashboard (Firebase Hosting)

### 2.1 — Configure environment files

Fill in the `firebaseConfig` values and `allowedEmail` in both environment files.
The config object is available in the Firebase console under **Project settings → Your apps → Web app**.

```typescript
// gcp/server/web/src/environments/environment.ts  (development)
// gcp/server/web/src/environments/environment.prod.ts  (production build)
export const environment = {
  production: false,   // true in environment.prod.ts
  allowedEmail: 'youremail@gmail.com',
  firebase: {
    apiKey: 'AIza...',
    authDomain: 'your-project-id.firebaseapp.com',
    projectId: 'your-project-id',
    storageBucket: 'your-project-id.firebasestorage.app',
    messagingSenderId: '000000000000',
    appId: '1:000000000000:web:abc123'
  }
};
```

> `allowedEmail` is the only email address that will be allowed to log in to the dashboard.
> Anyone else who attempts to sign in with Google will be rejected.

### 2.2 — Install dependencies

```bash
cd gcp/server/web
npm install
```

### 2.3 — Build for production

```bash
ng build
```

The output is written to `dist/web/browser/`.

### 2.4 — Log in to Firebase CLI

```bash
firebase login
```

### 2.5 — Initialize Firebase Hosting (first time only)

From `gcp/server/web/`:

```bash
firebase use YOUR_PROJECT_ID
```

If `firebase.json` does not exist yet, run:

```bash
firebase init hosting
```

When prompted:
- **Public directory**: `dist/web/browser`
- **Single-page app (rewrite all URLs to /index.html)**: **Yes**
- **Overwrite `index.html`**: **No**

### 2.6 — Deploy

```bash
firebase deploy --only hosting
```

The CLI will print the live URL when done:
```
Hosting URL: https://your-project-id.web.app
```

### 2.7 — Add the domain to Firebase Auth authorized domains

1. Go to **Firebase console → Authentication → Settings → Authorized domains**
2. Confirm that `your-project-id.web.app` and `your-project-id.firebaseapp.com` are listed
3. If you use a custom domain, add it here as well

---

## 3. Local development

```bash
cd gcp/server/web
npm install
ng serve
```

Open [http://localhost:4200](http://localhost:4200).

> Firebase Auth requires `localhost` to be in the authorized domains list.
> It is added automatically — no manual step needed for local development.

---

## Folder layout inside `function/`

| File | Description |
|---|---|
| `main.py` | Cloud Function entry point and all alert logic |
| `requirements.txt` | Python dependencies |
| `.env.example` | Environment variable reference (copy, fill in, and set in Cloud Function config) |

---

## Security notes

- The `deploy/` folder is excluded from git. It contains credentials and OAuth tokens that must never be committed.
- The Cloud Function has no public access (`--no-allow-unauthenticated`). Only the Service Account can invoke it via Cloud Scheduler.
- Gmail credentials are stored in Secret Manager and injected as environment variables at runtime — they are never embedded in the function source.
