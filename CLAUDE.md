# simple-speed-test-logger — Project Map

## Directory Structure

```
.
├── src/                  # Rust client (original — uses Google Apps Script)
├── googleAppScript/      # Google Apps Script backend (Sheets-based)
├── gcp/                  # GCP variant (Firestore + Cloud Functions + Angular UI)
│   ├── client/           # Rust client for GCP (writes to Firestore)
│   ├── server/           # Cloud Functions and GCP infrastructure
│   ├── docs/             # Documentation in English
│   └── docs-ptbr/        # Documentation in Portuguese (pt-BR)
└── prod/                 # Production deployment files and credentials
```

---

## Sub-project Guide

### `src/` — Rust Client (Google Apps Script variant)
- Original client, written in Rust
- Runs `speedtest-cli`, parses the result, and posts it to a **Google Apps Script** web app endpoint
- Entry: [src/main.rs](src/main.rs)
- Config: [config.json](config.json) (Apps Script URL + sheet settings)

### `googleAppScript/` — Google Apps Script backend
- Receives POST requests from the Rust client in `src/`
- Appends data rows to a Google Sheets spreadsheet
- Main script: [googleAppScript/Code.gs](googleAppScript/Code.gs)
- Deploy and usage instructions: [googleAppScript/README.md](googleAppScript/README.md)

### `gcp/` — GCP variant (independent project)
- A separate, more complete implementation using Google Cloud Platform
- `gcp/client/` — Rust client that writes directly to **Firestore**
- `gcp/server/` — Python **Cloud Functions** for alerting / health checks and Angular UI
- Has its own conventions defined in [gcp/CLAUDE.md](gcp/CLAUDE.md)
- Docs kept in sync bilingual: any change in `gcp/docs/` (EN) must be mirrored in `gcp/docs-ptbr/` (PT-BR) and vice-versa

### `prod/` — Production files
- Runtime config and service account credentials for the deployed instance
- Systemd unit files (`speedtest-logger.service` / `speedtest-logger.timer`) live at the repo root

---

## Which sub-project should I edit?

| Goal | Path |
|---|---|
| Change how data is sent to Google Sheets | `src/` + `googleAppScript/` |
| Change the GCP Rust client (Firestore writer) | `gcp/client/` |
| Change Cloud Functions / GCP infra | `gcp/server/` |
| Change Angular dashboard UI | `gcp/client/` (Angular app inside) |
| Update docs | `gcp/docs/` AND `gcp/docs-ptbr/` (both) |

---

## Further Reading

- GCP conventions (language, docs, clean code, i18n, theming): [gcp/CLAUDE.md](gcp/CLAUDE.md)
- GCP architecture overview: [gcp/architecture.md](gcp/architecture.md)
- Google Apps Script setup: [googleAppScript/README.md](googleAppScript/README.md)
