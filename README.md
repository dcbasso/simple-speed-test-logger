# speedtest-logger

Runs `speedtest` (Ookla's official CLI) periodically via a systemd timer and
records each result as a row in a Google Sheet, authenticating with a
Service Account (no browser/manual OAuth flow required).

## 1. Prerequisites on Linux

**Option A — via package repository (Debian/Ubuntu):**
```bash
curl -s https://packagecloud.io/install/repositories/ookla/speedtest-cli/script.deb.sh | sudo bash
sudo apt-get install speedtest
```

> If your distro is not supported (e.g. Debian 13 Trixie / Proxmox VE 9), use Option B.

**Option B — static binary (works on any distro):**
```bash
wget -O /tmp/speedtest.tgz "https://install.speedtest.net/app/cli/ookla-speedtest-1.2.0-linux-x86_64.tgz"
tar -xzf /tmp/speedtest.tgz -C /usr/local/bin speedtest
chmod +x /usr/local/bin/speedtest
```

**Accept the license (required on first run):**
```bash
speedtest --accept-license --accept-gdpr
```

## 2. Create a Service Account on Google Cloud

1. Go to https://console.cloud.google.com/ → create a project (or use an existing one).
2. Enable the **Google Sheets API** (APIs & Services > Library > Sheets API > Enable).
3. Go to **IAM & Admin > Service Accounts > Create Service Account**.
   - If asked *"What data will you be accessing?"*, choose **Application data**
     (the app accesses its own spreadsheet via a service account, not a Google user's data).
   - When asked to assign a **Role**, skip it (click Continue without selecting anything).
     Access to the spreadsheet is granted by sharing it directly with the service account
     email (step 3 below), not via IAM project roles.
4. After the service account is created, click on its name in the list to open it.
5. Go to the **Keys** tab → **Add Key** → **Create new key** → select **JSON** → click **Create**.
   - A `.json` file will be downloaded automatically — this is your `service-account.json`.
   - Keep it safe: it contains private credentials. Never commit it to git.
   - This file goes in the path set at `google.service_account_key_path` in `config.json`.
6. Open the downloaded file and copy the value of `"client_email"` (something like
   `speedtest-logger@YOUR-PROJECT.iam.gserviceaccount.com`). You will need it in the next step.

## 3. Share the spreadsheet with the Service Account

The Service Account has no Google Drive of its own — it can only access what is
explicitly shared with it:

1. Create a spreadsheet in Google Sheets.
2. Click **Share**, paste the service account's `client_email`,
   and grant **Editor** permission.
3. Grab the spreadsheet ID from the URL:
   `https://docs.google.com/spreadsheets/d/THE_ID_IS_HERE/edit`
4. (Optional) In the first row of the sheet, add headers:
   `timestamp | download_mbps | upload_mbps | ping_ms | jitter_ms | packet_loss_pct | server`

## 4. Configure the project

Edit `config.json` with the spreadsheet ID and the path to
`service-account.json`. See the example file in the project root.

## 5. Build

```bash
cargo build --release
sudo cp target/release/speedtest-logger /usr/local/bin/
```

## 6. Install as a systemd service

```bash
sudo useradd --system --no-create-home speedtest-logger
sudo mkdir -p /etc/speedtest-logger
sudo cp config.json /etc/speedtest-logger/
sudo cp /path/to/service-account.json /etc/speedtest-logger/
sudo chown -R speedtest-logger:speedtest-logger /etc/speedtest-logger
sudo chmod 600 /etc/speedtest-logger/service-account.json

sudo cp systemd/speedtest-logger.service /etc/systemd/system/
sudo cp systemd/speedtest-logger.timer /etc/systemd/system/

# Adjust OnUnitActiveSec in the .timer to match interval_minutes in config.json

sudo systemctl daemon-reload
sudo systemctl enable --now speedtest-logger.timer
```

## 7. Test manually / view logs

```bash
# Run once immediately
sudo systemctl start speedtest-logger.service

# View logs
journalctl -u speedtest-logger.service -f

# View upcoming scheduled runs
systemctl list-timers speedtest-logger.timer
```

## Notes

- The speedtest timeout is controlled by `speedtest.timeout_seconds` in the
  config — if the connection is very poor or the process hangs, it will be
  killed and the run will fail (logged in journalctl, not written to the sheet).
- `interval_minutes` in `config.json` is for documentation/reference only — the
  actual schedule is controlled by `OnUnitActiveSec` in the `.timer` file. If
  desired, the binary could be extended with a subcommand that generates the
  `.timer` automatically from the config, eliminating this duplicated value.
