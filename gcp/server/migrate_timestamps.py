"""
Migrates speedtest_results documents whose `timestamp` field is stored as a
string (ISO 8601) to a proper Firestore Timestamp value.

Uses the Firestore REST API with a Service Account JWT — same auth flow as the
Rust client — so no extra IAM roles are required.

Run:
    python3 migrate_timestamps.py
"""

import json
import time
import requests
from datetime import datetime, timezone

import jwt  # pip install PyJWT cryptography

PROJECT_ID   = "REDACTED_PROJECT_ID"
DATABASE_ID  = "speedtest-monitordb-one"
COLLECTION   = "speedtest_results"
SA_KEY_PATH  = "/home/dcbasso/worksapce/smallProjects/simple-speed-test-logger/gcp/client/deploy/REDACTED_PROJECT_ID-sa.json"

FIRESTORE_BASE = (
    f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}"
    f"/databases/{DATABASE_ID}/documents"
)
TOKEN_URI   = "https://oauth2.googleapis.com/token"
SCOPE       = "https://www.googleapis.com/auth/datastore"


def get_access_token(key: dict) -> str:
    """Exchanges a signed Service Account JWT for an OAuth2 access token."""
    now = int(time.time())
    claims = {
        "iss":   key["client_email"],
        "scope": SCOPE,
        "aud":   key["token_uri"],
        "iat":   now,
        "exp":   now + 3600,
    }
    signed = jwt.encode(claims, key["private_key"], algorithm="RS256")
    resp = requests.post(key["token_uri"], data={
        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
        "assertion":  signed,
    })
    resp.raise_for_status()
    return resp.json()["access_token"]


def list_all_documents(token: str) -> list[dict]:
    """Returns all documents in the collection (handles pagination)."""
    docs = []
    url = f"{FIRESTORE_BASE}/{COLLECTION}"
    params: dict = {"pageSize": 300}
    headers = {"Authorization": f"Bearer {token}"}

    while True:
        resp = requests.get(url, headers=headers, params=params)
        resp.raise_for_status()
        body = resp.json()
        docs.extend(body.get("documents", []))
        page_token = body.get("nextPageToken")
        if not page_token:
            break
        params["pageToken"] = page_token

    return docs


def patch_timestamp(token: str, doc_name: str, iso_str: str) -> None:
    """Overwrites the timestamp field with a proper Firestore timestampValue."""
    dt = datetime.fromisoformat(iso_str).astimezone(timezone.utc)
    rfc3339 = dt.strftime("%Y-%m-%dT%H:%M:%S.%fZ")

    url = f"https://firestore.googleapis.com/v1/{doc_name}"
    params = {"updateMask.fieldPaths": "timestamp"}
    body = {"fields": {"timestamp": {"timestampValue": rfc3339}}}
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    resp = requests.patch(url, headers=headers, params=params, json=body)
    resp.raise_for_status()


def migrate() -> None:
    import subprocess
    token = subprocess.check_output(
        ["gcloud", "auth", "print-access-token"], text=True
    ).strip()

    docs = list_all_documents(token)
    print(f"Found {len(docs)} documents.")

    migrated = 0
    skipped  = 0

    for doc in docs:
        fields    = doc.get("fields", {})
        ts_field  = fields.get("timestamp", {})
        str_value = ts_field.get("stringValue")

        if str_value:
            try:
                patch_timestamp(token, doc["name"], str_value)
                print(f"  migrated  {doc['name'].split('/')[-1]}  →  {str_value}")
                migrated += 1
            except Exception as e:
                print(f"  ERROR on {doc['name'].split('/')[-1]}: {e}")
        else:
            skipped += 1

    print(f"\nDone. migrated={migrated}  already_ok={skipped}")


if __name__ == "__main__":
    migrate()
