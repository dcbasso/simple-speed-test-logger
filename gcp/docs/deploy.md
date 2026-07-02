# Deploy — speedtest-logger GCP

## What gets deployed

| Component | Description |
|---|---|
| Cloud Function (`check-internet-status`) | Python function that checks Firestore for recent speedtest data and sends Gmail alerts |
| Cloud Scheduler job (`speedtest-monitor-scheduler`) | Triggers the function every 15 minutes |

---

## Pre-requisites

All steps in [pre-requisites.md](pre-requisites.md) must be completed before deploying:

- GCP project created and `gcloud` authenticated
- APIs enabled (Step 2)
- Firestore database created (Step 3)
- Service Account created with correct roles (Step 5)
- Gmail secrets stored in Secret Manager (Step 6)

---

## Running the deploy script

From the repository root:

```bash
bash gcp/server/deploy.sh
```

The script will:
1. Deploy the Cloud Function (gen2, Python 3.11, HTTP trigger, authenticated only)
2. Grant the Service Account invoker permission on the function
3. Create or update the Cloud Scheduler job (every 15 minutes)

> **Note:** The first deploy takes ~2 minutes. Re-deploys are faster.

---

## Configuration

Edit the variables at the top of [gcp/server/deploy.sh](../server/deploy.sh) before running:

| Variable | Default | Description |
|---|---|---|
| `PROJECT_ID` | `speedtest-monitor-501022` | Your GCP project ID |
| `REGION` | `southamerica-east1` | Must match the Firestore region from Step 3 |
| `ALERT_EMAIL` | `dcbasso@gmail.com` | Email that receives down/recovery alerts |
| `TIMEZONE` | `America/Sao_Paulo` | Scheduler timezone |
| `SCHEDULE` | `*/15 * * * *` | Cron expression (every 15 min) |

---

## Manual test

After deploying, trigger the function immediately to verify it works:

```bash
gcloud scheduler jobs run speedtest-monitor-scheduler \
  --project=speedtest-monitor-501022 \
  --location=southamerica-east1
```

Then check the function logs:

```bash
gcloud functions logs read check-internet-status \
  --gen2 \
  --project=speedtest-monitor-501022 \
  --region=us-east1 \
  --limit=50
```

---

## Firestore initial config (optional)

By default the function uses the `ALERT_EMAIL` env var and a 45-minute threshold.
To configure it from Firestore instead (allows changing without redeploying), create the config document:

```bash
# Install the Firestore CLI helper (one-time)
pip install google-cloud-firestore

# Or use the Firebase console:
# Firestore → monitor_config collection → current document
# Fields: alert_email (string), max_minutes_without_data (number)
```

Or via the GCP console: **Firestore → monitor_config → current** with fields:

| Field | Type | Example |
|---|---|---|
| `alert_email` | string | `dcbasso@gmail.com` |
| `max_minutes_without_data` | number | `45` |

---

## Re-deploy after code changes

Just run the same script again — it updates the existing function and scheduler job:

```bash
bash gcp/server/deploy.sh
```

---

## Teardown

To remove all deployed resources:

```bash
gcloud scheduler jobs delete speedtest-monitor-scheduler \
  --project=speedtest-monitor-501022 --location=southamerica-east1

gcloud functions delete check-internet-status \
  --gen2 --project=speedtest-monitor-501022 --region=us-east1
```
