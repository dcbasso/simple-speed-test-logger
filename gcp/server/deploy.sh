#!/usr/bin/env bash
# Deploy the check-internet-status Cloud Function and configure Cloud Scheduler.
# Run from the repo root or from gcp/server/:
#   bash gcp/server/deploy.sh
set -euo pipefail

# ── Configuration ────────────────────────────────────────────────────────────
# HOSTING_PROJECT: GCP project where the Cloud Function and Scheduler live.
# DATA_PROJECT: Firebase project where Firestore data is stored.
# These are two different projects: DATA_PROJECT is the Firebase/free-tier project
# (no billing for Secret Manager), HOSTING_PROJECT has billing enabled.
HOSTING_PROJECT="speedtest-monitor-501022"
DATA_PROJECT="REDACTED_PROJECT_ID"
REGION="southamerica-east1"
FUNCTION_NAME="check-internet-status"
SA="speedtest-sa@${HOSTING_PROJECT}.iam.gserviceaccount.com"
ALERT_EMAIL="dcbasso@gmail.com"
FIRESTORE_DATABASE="speedtest-monitordb-one"
SCHEDULER_JOB="speedtest-monitor-scheduler"
TIMEZONE="America/Sao_Paulo"
SCHEDULE="*/5 * * * *"
# ─────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FUNCTION_SOURCE="$SCRIPT_DIR/function"

echo "==> Deploying Cloud Function: $FUNCTION_NAME"
gcloud functions deploy "$FUNCTION_NAME" \
  --gen2 \
  --project="$HOSTING_PROJECT" \
  --region="$REGION" \
  --runtime=python311 \
  --source="$FUNCTION_SOURCE" \
  --entry-point=check_internet_status \
  --trigger-http \
  --no-allow-unauthenticated \
  --service-account="$SA" \
  --set-env-vars="GCP_PROJECT_ID=$DATA_PROJECT,ALERT_EMAIL=$ALERT_EMAIL,FIRESTORE_DATABASE=$FIRESTORE_DATABASE" \
  --set-secrets="GMAIL_CLIENT_ID=gmail-client-id:latest,GMAIL_CLIENT_SECRET=gmail-client-secret:latest,GMAIL_REFRESH_TOKEN=gmail-refresh-token:latest"

echo "==> Fetching function URL"
FUNCTION_URL=$(gcloud functions describe "$FUNCTION_NAME" \
  --gen2 \
  --project="$HOSTING_PROJECT" \
  --region="$REGION" \
  --format="value(serviceConfig.uri)")
echo "    URL: $FUNCTION_URL"

echo "==> Granting invoker role to service account"
gcloud run services add-iam-policy-binding "$FUNCTION_NAME" \
  --project="$HOSTING_PROJECT" \
  --region="$REGION" \
  --member="serviceAccount:$SA" \
  --role="roles/run.invoker"

echo "==> Configuring Cloud Scheduler job: $SCHEDULER_JOB"
if gcloud scheduler jobs describe "$SCHEDULER_JOB" \
    --project="$HOSTING_PROJECT" \
    --location="$REGION" &>/dev/null; then
  echo "    Job exists — updating"
  gcloud scheduler jobs update http "$SCHEDULER_JOB" \
    --project="$HOSTING_PROJECT" \
    --location="$REGION" \
    --schedule="$SCHEDULE" \
    --uri="$FUNCTION_URL" \
    --oidc-service-account-email="$SA" \
    --oidc-token-audience="$FUNCTION_URL" \
    --time-zone="$TIMEZONE"
else
  echo "    Job not found — creating"
  gcloud scheduler jobs create http "$SCHEDULER_JOB" \
    --project="$HOSTING_PROJECT" \
    --location="$REGION" \
    --schedule="$SCHEDULE" \
    --uri="$FUNCTION_URL" \
    --oidc-service-account-email="$SA" \
    --oidc-token-audience="$FUNCTION_URL" \
    --time-zone="$TIMEZONE"
fi

echo ""
echo "==> Deploy complete."
echo "    Function URL : $FUNCTION_URL"
echo "    Scheduler    : every 5 min ($TIMEZONE)"
echo ""
echo "    To trigger a manual test run:"
echo "    gcloud scheduler jobs run $SCHEDULER_JOB --project=$HOSTING_PROJECT --location=$REGION"
