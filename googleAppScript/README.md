# googleAppScript — Internet Monitor

A Google Apps Script that monitors internet connectivity by checking whether the [speedtest-logger](../) Rust app has been writing data to the Google Sheet recently.

## How it works

The Rust app writes a new row to the sheet every 15 minutes — but only when it has internet access. The Apps Script runs every 30 minutes and checks the timestamp of the last row:

- If the last record is **older than 45 minutes** → internet is likely down → sends an alert email
- If the last record becomes **recent again** → internet came back → sends a recovery email

Spam is prevented via `PropertiesService`, which persists state between executions indefinitely. Each event (down / recovery) triggers exactly one email.

```
[Proxmox — every 15 min]           [Apps Script — every 30 min]
speedtest → writes to Sheet   →    reads last row timestamp
                                   if > 45 min old → send alert (once)
                                   if recent again → send recovery (once)
```

## Files

| File | Description |
|---|---|
| `Code.gs` | Main monitoring script |
| `appsscript.json` | Manifest — timezone, OAuth scopes |

## Configuration

Edit the constants at the top of `Code.gs`:

| Constant | Default | Description |
|---|---|---|
| `SHEET_NAME` | `"tests"` | Name of the sheet tab |
| `ALERT_EMAIL` | `"dcbasso@gmail.com"` | Recipient for alert emails |
| `MAX_MINUTES_WITHOUT_DATA` | `45` | Threshold in minutes to consider internet down |

## Spreadsheet

A ready-to-use example spreadsheet is available:
**[Open example on Google Sheets](https://docs.google.com/spreadsheets/d/1RmNpQxL4VTGkR9y4J7pkdzm69i1FIRLB3RCZkara5lQ/edit?usp=sharing)**

> **Alternative — xlsx format:** An `.xlsx` file is also available in this repo. To use it you need to import it into Google Drive and convert it to the native Google Sheets format (File → Save as Google Sheets). This path is more complex and is only recommended if you need a local copy of the template.

## Setup

1. Open the Google Sheet → **Extensions → Apps Script**
2. Replace the default `Code.gs` content with the content of `Code.gs`
3. In the editor settings, enable **"Show appsscript.json manifest file"** and replace its content with `appsscript.json`
4. Add a time-based trigger:
   - **Triggers → Add Trigger**
   - Function: `checkInternetStatus`
   - Event source: **Time-driven**
   - Type: **Minutes timer → Every 30 minutes**
5. Authorize the requested permissions on the first run

## Utilities

- **`resetState()`** — run once from the editor to clear the persisted down/up state (useful after testing)
