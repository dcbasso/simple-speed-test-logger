# Task 02: Python Cloud Function — Internet Monitor

## Context
Replaces the Google Apps Script (`googleAppScript/Code.gs`) with a Cloud Function (Gen 2).
The function is triggered by Cloud Scheduler every 15 minutes, checks whether fresh speedtest
data exists in Firestore, and sends Gmail alerts on state transitions (up → down, down → up).
State is persisted in Firestore instead of `PropertiesService`.

## Goal
Implement and deploy `gcp/server/function/main.py` as a Cloud Function Gen 2 (HTTP trigger),
with the same alert logic as the current Apps Script but reading config from Firestore.

## Acceptance Criteria
- [ ] Function deploys successfully via `gcloud functions deploy`
- [ ] When called with no recent Firestore data: sends "internet down" email and creates incident document
- [ ] When called after recovery: sends "internet back" email and updates incident with `recovered_at`
- [ ] Does not send duplicate alerts (state check via `monitor_state/current`)
- [ ] Reads `max_minutes_without_data` and `alert_email` from `monitor_config/current`
- [ ] Falls back to env var defaults if `monitor_config/current` does not exist
- [ ] Gmail auth uses OAuth2 refresh token from Secret Manager
- [ ] Every function has a Google-style docstring
- [ ] All code is in English

## Technical Notes

### Files to create
- `gcp/server/function/main.py`
- `gcp/server/function/requirements.txt`
- `gcp/server/function/.env.example`

### requirements.txt
```
functions-framework==3.*
google-cloud-firestore==2.*
google-auth==2.*
google-auth-oauthlib==1.*
google-api-python-client==2.*
```

### Environment variables (set in Cloud Function config)
| Variable | Default | Description |
|---|---|---|
| `GCP_PROJECT_ID` | — | Required. GCP project ID |
| `ALERT_EMAIL` | — | Fallback email if Firestore config missing |
| `MAX_MINUTES_WITHOUT_DATA` | `45` | Fallback threshold |

### Secret Manager secrets (mounted as env vars or accessed via SDK)
- `gmail-client-id`
- `gmail-client-secret`
- `gmail-refresh-token`

### Logic flow
```
1. Read monitor_config/current from Firestore (fallback to env vars)
2. Query speedtest_results: latest document ordered by timestamp DESC, limit 1
3. Calculate diff_minutes = now - last_timestamp
4. Read monitor_state/current { internet_down: bool }
5. If diff_minutes > max_minutes:
     If internet_down == False:
       → Create doc in `incidents` { started_at: now, recovered_at: null }
       → Send "internet down" email
       → Update monitor_state: { internet_down: true }
6. If diff_minutes <= max_minutes:
     If internet_down == True:
       → Update latest incident doc: { recovered_at: now, duration_minutes: diff }
       → Send "internet back" email
       → Update monitor_state: { internet_down: false }
7. Return HTTP 200
```

### Gmail send via OAuth2 refresh token
```python
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

creds = Credentials(
    token=None,
    refresh_token=REFRESH_TOKEN,
    client_id=CLIENT_ID,
    client_secret=CLIENT_SECRET,
    token_uri="https://oauth2.googleapis.com/token"
)
service = build("gmail", "v1", credentials=creds)
```

## References
- `googleAppScript/Code.gs` — original logic to replicate
- `gcp/architecture.md` — Firestore collections (`monitor_state`, `incidents`, `monitor_config`)
- `gcp/CLAUDE.md` — code conventions (English, docstrings, clean code)
- `gcp/docs/pre-requisites.md` — Secret Manager setup (Step 6)

## Definition of Done
Calling the function URL manually returns HTTP 200. Simulating absence of Firestore data
(delete or backdate the last document) triggers a "down" email. Adding a fresh document
and calling again triggers a "recovery" email. Incident documents exist in Firestore.
