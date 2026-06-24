// Configuration — adjust as needed
const SHEET_NAME = "tests";
const ALERT_EMAIL = "youremail@gmail.com";
const MAX_MINUTES_WITHOUT_DATA = 45;

// Key used in PropertiesService to persist state between executions
const PROP_INTERNET_DOWN = "INTERNET_DOWN";

function checkInternetStatus() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) {
    Logger.log("Sheet not found: " + SHEET_NAME);
    return;
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    Logger.log("No data rows found (header only or empty sheet).");
    return;
  }

  // Column A = timestamp (structure: timestamp | download | upload | ping | jitter | loss | server)
  // The Rust app writes ISO 8601 strings (e.g. "2026-06-22T13:34:10.900903585+00:00")
  const rawValue = sheet.getRange(lastRow, 1).getValue();
  const lastTimestamp = rawValue instanceof Date ? rawValue : new Date(rawValue);
  if (isNaN(lastTimestamp.getTime())) {
    Logger.log("Could not parse timestamp from last row, column A: " + rawValue);
    return;
  }

  const now = new Date();
  const diffMinutes = (now - lastTimestamp) / 1000 / 60;

  Logger.log(`Last record: ${lastTimestamp.toLocaleString("en-US")} — ${Math.round(diffMinutes)} min ago`);

  const props = PropertiesService.getScriptProperties();
  const wasDown = props.getProperty(PROP_INTERNET_DOWN) === "true";

  if (diffMinutes > MAX_MINUTES_WITHOUT_DATA) {
    if (!wasDown) {
      sendDownAlert_(lastTimestamp, diffMinutes);
      props.setProperty(PROP_INTERNET_DOWN, "true");
    }
    // Already marked as down — do not send again (no spam)
  } else {
    if (wasDown) {
      sendRecoveryAlert_(lastTimestamp);
      props.setProperty(PROP_INTERNET_DOWN, "false");
    }
    // Everything normal — nothing to do
  }
}

function sendDownAlert_(lastTimestamp, diffMinutes) {
  MailApp.sendEmail({
    to: ALERT_EMAIL,
    subject: "[speedtest-logger] ⚠️ Internet is down",
    body:
      `No speedtest record since ${lastTimestamp.toLocaleString("en-US")}.\n\n` +
      `Approximately ${Math.round(diffMinutes)} minutes without data.\n\n` +
      `You will receive another email once the internet comes back.`,
  });
  Logger.log("Down alert email sent.");
}

function sendRecoveryAlert_(lastTimestamp) {
  MailApp.sendEmail({
    to: ALERT_EMAIL,
    subject: "[speedtest-logger] ✅ Internet is back",
    body: `The internet appears to be back.\n\nLast record detected: ${lastTimestamp.toLocaleString("en-US")}.`,
  });
  Logger.log("Recovery email sent.");
}

// Utility to manually reset state (run once from the editor if needed)
function resetState() {
  PropertiesService.getScriptProperties().deleteProperty(PROP_INTERNET_DOWN);
  Logger.log("State reset.");
}
