# Task 01: Rust Client — Firestore Integration

## Context
The current Rust binary at `/src` sends speedtest results to Google Sheets.
This task ports that binary to `gcp/client/`, replacing the Sheets destination with Firestore.
The core logic (`speedtest.rs`) is reused unchanged. Only the transport layer changes.

## Goal
Create `gcp/client/` as a standalone Rust workspace that compiles and runs independently,
sending speedtest results to the `speedtest_results` Firestore collection.

## Acceptance Criteria
- [x] `cargo build --release` succeeds inside `gcp/client/`
- [x] Running the binary executes a real speedtest and writes a document to Firestore
- [x] All fields from `SpeedtestResult` are present in the Firestore document
- [x] Auth uses Service Account JWT (RS256) with scope `https://www.googleapis.com/auth/datastore`
- [x] `config.json` uses the new `gcp` section (project_id, collection) instead of `google` section
- [x] Timeout and error handling behave identically to the current binary
- [x] Every public function has rustdoc (`///`) documentation
- [x] All code is in English

## Technical Notes

### Files to create
- `gcp/client/Cargo.toml` — new package, same dependencies minus `jsonwebtoken` scope change
- `gcp/client/src/main.rs` — copy from `/src/main.rs`, update module imports
- `gcp/client/src/config.rs` — replace `GoogleConfig` with `FirestoreConfig { project_id, collection }`
- `gcp/client/src/speedtest.rs` — copy unchanged from `/src/speedtest.rs`
- `gcp/client/src/firestore.rs` — new file, replaces `sheets.rs`
- `gcp/client/config.json.example` — example config with the new schema

### Firestore REST endpoint
```
POST https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents/{COLLECTION}
```

### Auth scope
```
https://www.googleapis.com/auth/datastore
```

### Firestore document format
The REST API expects fields wrapped in type descriptors:
```json
{
  "fields": {
    "timestamp":        { "stringValue": "2026-06-27T12:00:00Z" },
    "download_mbps":    { "doubleValue": 98.5 },
    "upload_mbps":      { "doubleValue": 45.2 },
    "ping_ms":          { "doubleValue": 12.1 },
    "jitter_ms":        { "doubleValue": 1.3 },
    "packet_loss_pct":  { "doubleValue": 0.0 },
    "server":           { "stringValue": "Server Name - City, Country" },
    "isp":              { "stringValue": "ISP Name" },
    "external_ip":      { "stringValue": "1.2.3.4" },
    "result_url":       { "stringValue": "https://..." }
  }
}
```

### config.json schema (new)
```json
{
  "interval_minutes": 15,
  "speedtest": {
    "binary_path": "speedtest",
    "timeout_seconds": 60
  },
  "gcp": {
    "service_account_key_path": "/etc/speedtest-logger/service-account.json",
    "project_id": "YOUR_PROJECT_ID",
    "collection": "speedtest_results"
  },
  "log": {
    "path": "/var/log/speedtest-logger.log",
    "level": "info"
  }
}
```

## References
- `/src/main.rs`, `/src/speedtest.rs`, `/src/sheets.rs`, `/src/config.rs` — source to port from
- `gcp/architecture.md` — Firestore data model and auth decisions
- `gcp/CLAUDE.md` — code conventions (English, rustdoc, clean code)
- `gcp/docs/pre-requisites.md` — Service Account setup

## Definition of Done
Running `./target/release/speedtest-logger-client --config config.json` writes a new document
to Firestore and exits with code 0. Document is visible in the GCP Console under Firestore.
