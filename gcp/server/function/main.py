"""Cloud Function — Internet Monitor.

Triggered by Cloud Scheduler every 5 minutes. Reads the latest speedtest
document from Firestore, compares its timestamp against a configurable
threshold, and sends Gmail alerts on state transitions (up→down, down→up).
Incident records are persisted in Firestore.
"""

import base64
import email.mime.text
import logging
import os
from datetime import datetime, timezone

import functions_framework
from google.cloud import firestore
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

COLLECTION_SPEEDTEST = "speedtest_results"
COLLECTION_STATE = "monitor_state"
COLLECTION_CONFIG = "monitor_config"
COLLECTION_INCIDENTS = "incidents"
STATE_DOC = "current"
CONFIG_DOC = "current"

DEFAULT_MAX_MINUTES = 10
DEFAULT_ALERT_EMAIL = os.environ.get("ALERT_EMAIL", "")

_gmail_service = None


def _get_firestore_client() -> firestore.Client:
    """Returns a Firestore client using the default application credentials.

    Reads GCP_PROJECT_ID and FIRESTORE_DATABASE from environment variables.
    FIRESTORE_DATABASE defaults to "(default)" if not set.

    Returns:
        An authenticated Firestore client for the configured GCP project.
    """
    project_id = os.environ["GCP_PROJECT_ID"]
    database = os.environ.get("FIRESTORE_DATABASE", "(default)")
    return firestore.Client(project=project_id, database=database)


def _load_monitor_config(db: firestore.Client) -> tuple[int, str]:
    """Reads monitoring configuration from Firestore, falling back to env vars.

    Args:
        db: Authenticated Firestore client.

    Returns:
        A tuple of (max_minutes_without_data, alert_email).
    """
    doc = db.collection(COLLECTION_CONFIG).document(CONFIG_DOC).get()
    if doc.exists:
        data = doc.to_dict()
        max_minutes = int(data.get("max_minutes_without_data", DEFAULT_MAX_MINUTES))
        alert_email = data.get("alert_email", DEFAULT_ALERT_EMAIL)
    else:
        logger.warning("monitor_config/current not found — using env var defaults")
        max_minutes = int(os.environ.get("MAX_MINUTES_WITHOUT_DATA", DEFAULT_MAX_MINUTES))
        alert_email = DEFAULT_ALERT_EMAIL

    return max_minutes, alert_email


def _get_latest_speedtest_timestamp(db: firestore.Client) -> datetime | None:
    """Queries the most recent speedtest result from Firestore.

    Args:
        db: Authenticated Firestore client.

    Returns:
        The UTC timestamp of the latest document, or None if the collection is empty.
    """
    docs = (
        db.collection(COLLECTION_SPEEDTEST)
        .order_by("timestamp", direction=firestore.Query.DESCENDING)
        .limit(1)
        .stream()
    )
    for doc in docs:
        data = doc.to_dict()
        ts = data.get("timestamp")
        if isinstance(ts, datetime):
            return ts.astimezone(timezone.utc)
        if isinstance(ts, str):
            return datetime.fromisoformat(ts).astimezone(timezone.utc)
    return None


def _read_monitor_state(db: firestore.Client) -> bool:
    """Reads the current internet-down state from Firestore.

    Args:
        db: Authenticated Firestore client.

    Returns:
        True if the internet was previously flagged as down, False otherwise.
    """
    doc = db.collection(COLLECTION_STATE).document(STATE_DOC).get()
    if doc.exists:
        return bool(doc.to_dict().get("internet_down", False))
    return False


def _write_monitor_state(db: firestore.Client, internet_down: bool) -> None:
    """Persists the current internet-down state to Firestore.

    Args:
        db: Authenticated Firestore client.
        internet_down: True if the internet is currently considered down.
    """
    now = datetime.now(timezone.utc)
    field = "last_down_alert_at" if internet_down else "last_recovery_alert_at"
    db.collection(COLLECTION_STATE).document(STATE_DOC).set(
        {"internet_down": internet_down, field: now},
        merge=True,
    )


def _create_incident(db: firestore.Client) -> str:
    """Creates a new incident document marking the start of an outage.

    Args:
        db: Authenticated Firestore client.

    Returns:
        The auto-generated document ID of the created incident.
    """
    now = datetime.now(timezone.utc)
    _, ref = db.collection(COLLECTION_INCIDENTS).add(
        {"started_at": now, "recovered_at": None, "duration_minutes": None}
    )
    return ref.id


def _close_latest_incident(db: firestore.Client) -> None:
    """Updates the most recent open incident with its recovery time and duration.

    Queries the most recent incident by started_at and closes it if still open.
    Avoids a composite index by filtering recovered_at in Python.

    Args:
        db: Authenticated Firestore client.
    """
    docs = (
        db.collection(COLLECTION_INCIDENTS)
        .order_by("started_at", direction=firestore.Query.DESCENDING)
        .limit(1)
        .stream()
    )
    now = datetime.now(timezone.utc)
    for doc in docs:
        data = doc.to_dict()
        if data.get("recovered_at") is not None:
            logger.warning("Latest incident %s is already closed — skipping", doc.id)
            return
        started_at = data.get("started_at")
        duration = None
        if isinstance(started_at, datetime):
            duration = round((now - started_at.astimezone(timezone.utc)).total_seconds() / 60)
        doc.reference.update({"recovered_at": now, "duration_minutes": duration})
        logger.warning("Incident %s closed — duration: %s min", doc.id, duration)


def _build_gmail_service():
    """Builds an authenticated Gmail API service using OAuth2 secrets from env vars.

    Reads GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN from
    environment variables (injected from Secret Manager by Cloud Functions).

    Returns:
        An authorized Gmail API Resource object.
    """
    global _gmail_service
    if _gmail_service is not None:
        return _gmail_service

    creds = Credentials(
        token=None,
        refresh_token=os.environ["GMAIL_REFRESH_TOKEN"],
        client_id=os.environ["GMAIL_CLIENT_ID"],
        client_secret=os.environ["GMAIL_CLIENT_SECRET"],
        token_uri="https://oauth2.googleapis.com/token",
        scopes=["https://www.googleapis.com/auth/gmail.send"],
    )
    creds.refresh(Request())
    _gmail_service = build("gmail", "v1", credentials=creds)
    return _gmail_service


def _send_email(to: str, subject: str, body: str) -> None:
    """Sends an email via the Gmail API.

    Args:
        to: Recipient email address.
        subject: Email subject line.
        body: Plain-text email body.
    """
    global _gmail_service
    message = email.mime.text.MIMEText(body)
    message["to"] = to
    message["subject"] = subject
    raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
    try:
        service = _build_gmail_service()
        service.users().messages().send(userId="me", body={"raw": raw}).execute()
    except Exception:
        # Connection may be stale — discard cached service and retry once with a fresh one.
        _gmail_service = None
        service = _build_gmail_service()
        service.users().messages().send(userId="me", body={"raw": raw}).execute()
    logger.info("Email sent to %s — subject: %s", to, subject)


def _send_down_alert(alert_email: str, last_timestamp: datetime, diff_minutes: float) -> None:
    """Sends an internet-down alert email.

    Args:
        alert_email: Recipient address.
        last_timestamp: UTC timestamp of the last received speedtest record.
        diff_minutes: Minutes elapsed since the last record.
    """
    _send_email(
        to=alert_email,
        subject="[speedtest-logger] Internet is down",
        body=(
            f"No speedtest record since {last_timestamp.strftime('%Y-%m-%d %H:%M:%S UTC')}.\n\n"
            f"Approximately {round(diff_minutes)} minutes without data.\n\n"
            "You will receive another email once the internet comes back."
        ),
    )


def _send_recovery_alert(alert_email: str, last_timestamp: datetime) -> None:
    """Sends an internet-recovery alert email.

    Args:
        alert_email: Recipient address.
        last_timestamp: UTC timestamp of the most recent speedtest record.
    """
    _send_email(
        to=alert_email,
        subject="[speedtest-logger] Internet is back",
        body=(
            "The internet appears to be back.\n\n"
            f"Last record detected: {last_timestamp.strftime('%Y-%m-%d %H:%M:%S UTC')}."
        ),
    )


@functions_framework.http
def check_internet_status(request) -> tuple[str, int]:
    """Check whether recent speedtest data exists and send alert emails if needed.

    Reads the latest document from Firestore, compares its timestamp against
    the configured threshold, and sends a Gmail alert on state transitions
    (down→up or up→down). Incident documents are created and closed accordingly.

    Args:
        request: HTTP request object provided by Cloud Functions runtime.

    Returns:
        A tuple of (response_body, http_status_code).
    """
    try:
        db = _get_firestore_client()
        max_minutes, alert_email = _load_monitor_config(db)

        last_timestamp = _get_latest_speedtest_timestamp(db)
        if last_timestamp is None:
            logger.warning("No speedtest documents found in Firestore — skipping check")
            return "No data available", 200

        now = datetime.now(timezone.utc)
        diff_minutes = (now - last_timestamp).total_seconds() / 60

        logger.info(
            "Last record: %s — %.1f min ago (threshold: %d min)",
            last_timestamp.strftime("%Y-%m-%d %H:%M:%S UTC"),
            diff_minutes,
            max_minutes,
        )

        internet_was_down = _read_monitor_state(db)

        if diff_minutes > max_minutes:
            if not internet_was_down:
                logger.info("Internet appears DOWN — sending alert and creating incident")
                _create_incident(db)
                _write_monitor_state(db, internet_down=True)
                _send_down_alert(alert_email, last_timestamp, diff_minutes)
            else:
                logger.info("Internet still DOWN — no duplicate alert sent")
        else:
            if internet_was_down:
                logger.info("Internet is BACK — sending recovery alert and closing incident")
                _close_latest_incident(db)
                _write_monitor_state(db, internet_down=False)
                _send_recovery_alert(alert_email, last_timestamp)
            else:
                logger.info("Internet is UP — nothing to do")

        return "OK", 200

    except Exception as exc:
        logger.exception("Unexpected error during internet status check: %s", exc)
        return f"Internal error: {exc}", 500
