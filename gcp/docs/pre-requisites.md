# Prerequisites — speedtest-logger GCP

## What you will need

- Google account (personal Gmail works)
- [Google Cloud CLI (`gcloud`)](https://cloud.google.com/sdk/docs/install) installed
- [Firebase CLI (`firebase`)](https://firebase.google.com/docs/cli#install_the_firebase_cli) installed
- [Terraform](https://developer.hashicorp.com/terraform/install) installed
- [Node.js 20+](https://nodejs.org/) installed (for Angular)
- [Rust](https://rustup.rs/) installed (for the local client)

---

### Step 1 — Create the GCP project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click **Select a project → New Project**
3. Enter a name (e.g. `speedtest-monitor`) and note the generated **Project ID**
4. Click **Create**
5. Set it as the active project

In the terminal:
```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

---

### Step 2 — Enable required APIs

```bash
gcloud services enable \
  firestore.googleapis.com \
  cloudfunctions.googleapis.com \
  cloudscheduler.googleapis.com \
  secretmanager.googleapis.com \
  gmail.googleapis.com \
  firebase.googleapis.com \
  identitytoolkit.googleapis.com
```

---

### Step 3 — Create the Firestore database

1. In the GCP console, go to **Firestore**
2. Click **Create Database**
3. Select **Native mode** (not Datastore mode)
4. Choose the nearest region (e.g. `us-east1`)
5. Click **Create**

---

### Step 4 — Configure Firebase

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project → select the GCP project you just created**
3. Follow the wizard (you can disable Google Analytics)
4. In the sidebar, go to **Authentication → Get started**
5. Under **Sign-in method**, enable **Google**
6. Set the **Project support email** to your email
7. Click **Save**

---

### Step 5 — Create the Service Account

```bash
# Create the SA
gcloud iam service-accounts create speedtest-sa \
  --display-name="speedtest-logger Service Account"

# Grant Firestore access
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:speedtest-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/datastore.user"

# Grant Cloud Functions invoker (for Cloud Scheduler)
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:speedtest-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudfunctions.invoker"

# Grant Secret Manager access
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:speedtest-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Generate and download the JSON key (used by the local Rust client)
gcloud iam service-accounts keys create ~/speedtest-sa-key.json \
  --iam-account="speedtest-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com"
```

Move the file to a secure location:
```bash
sudo mkdir -p /etc/speedtest-logger
sudo mv ~/speedtest-sa-key.json /etc/speedtest-logger/service-account.json
sudo chmod 600 /etc/speedtest-logger/service-account.json
```

---

### Step 6 — Configure Gmail OAuth2 (one-time)

#### 6.1 — Create OAuth2 credentials

1. In the GCP console, go to **APIs & Services → Credentials**
2. Click **Create Credentials → OAuth client ID**
3. If prompted, configure the **OAuth consent screen** first:
   - User Type: **External**
   - App name: `speedtest-logger`
   - Support email: your email
   - Under **Scopes**, add `https://www.googleapis.com/auth/gmail.send`
   - Under **Test users**, add your email
4. Return to **Create Credentials → OAuth client ID**
5. Application type: **Desktop app**
6. Click **Create** and note the **Client ID** and **Client Secret**

#### 6.2 — Obtain the refresh token (run once)

Install the required Python library:
```bash
pip install google-auth-oauthlib
```

Run the following script locally (replace the values):
```python
from google_auth_oauthlib.flow import InstalledAppFlow

flow = InstalledAppFlow.from_client_secrets_file(
    'client_secret.json',  # file downloaded in the previous step
    scopes=['https://www.googleapis.com/auth/gmail.send']
)
creds = flow.run_local_server(port=0)
print("refresh_token:", creds.refresh_token)
```

Note the `refresh_token` printed in the terminal.

#### 6.3 — Store in Secret Manager

```bash
# Client ID
echo -n "YOUR_CLIENT_ID" | \
  gcloud secrets create gmail-client-id --data-file=-

# Client Secret
echo -n "YOUR_CLIENT_SECRET" | \
  gcloud secrets create gmail-client-secret --data-file=-

# Refresh Token
echo -n "YOUR_REFRESH_TOKEN" | \
  gcloud secrets create gmail-refresh-token --data-file=-
```

---

### Step 7 — Set the allowed email for the dashboard

The dashboard allows only **one email**. Configure it in the Angular environment file before building:

```typescript
// gcp/server/web/src/environments/environment.prod.ts
export const environment = {
  allowedEmail: 'youremail@gmail.com',  // replace with your email
  // Firebase config will be added here
};
```

---

### Step 8 — Get Firebase config for Angular

1. In the Firebase console, go to **Project settings** (gear icon)
2. Under **Your apps**, click **Add app → Web (`</>`)**
3. Register the app with a nickname (e.g. `speedtest-web`)
4. Copy the `firebaseConfig` object shown
5. Paste it into `environment.ts` and `environment.prod.ts`

```typescript
export const environment = {
  allowedEmail: 'youremail@gmail.com',
  firebase: {
    apiKey: "...",
    authDomain: "...",
    projectId: "...",
    storageBucket: "...",
    messagingSenderId: "...",
    appId: "..."
  }
};
```

---

### Final checklist

- [ ] GCP project created and `gcloud` configured with the correct Project ID
- [ ] APIs enabled (Step 2)
- [ ] Firestore created in Native mode
- [ ] Firebase configured with Google Sign-In enabled
- [ ] Service Account created with correct roles
- [ ] JSON key at `/etc/speedtest-logger/service-account.json`
- [ ] Gmail secrets created in Secret Manager (`gmail-client-id`, `gmail-client-secret`, `gmail-refresh-token`)
- [ ] Allowed email set in `environment.prod.ts`
- [ ] `firebaseConfig` copied to environment files
