use crate::config::{GoogleConfig, ServiceAccountKey};
use crate::speedtest::SpeedtestResult;
use anyhow::{bail, Context, Result};
use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

const SHEETS_SCOPE: &str = "https://www.googleapis.com/auth/spreadsheets";

#[derive(Debug, Serialize)]
struct Claims {
    iss: String,
    scope: String,
    aud: String,
    iat: u64,
    exp: u64,
}

#[derive(Debug, Deserialize)]
struct TokenResponse {
    access_token: String,
}

/// Monta e assina um JWT com a chave privada da service account, troca
/// por um access_token OAuth2 (fluxo "JWT Bearer", sem passar por browser).
pub async fn get_access_token(google: &GoogleConfig) -> Result<String> {
    let key = ServiceAccountKey::load(&google.service_account_key_path)?;

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .context("Falha ao obter horário do sistema")?
        .as_secs();

    let claims = Claims {
        iss: key.client_email.clone(),
        scope: SHEETS_SCOPE.to_string(),
        aud: key.token_uri.clone(),
        iat: now,
        exp: now + 3600,
    };

    let header = Header::new(Algorithm::RS256);
    let encoding_key = EncodingKey::from_rsa_pem(key.private_key.as_bytes())
        .context("Chave privada inválida no service-account.json")?;

    let jwt = encode(&header, &claims, &encoding_key)
        .context("Falha ao assinar o JWT")?;

    let client = reqwest::Client::new();
    let response = client
        .post(&key.token_uri)
        .form(&[
            ("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer"),
            ("assertion", jwt.as_str()),
        ])
        .send()
        .await
        .context("Falha ao chamar o endpoint de token do Google")?;

    let status = response.status();
    let body = response.text().await.unwrap_or_default();

    if !status.is_success() {
        bail!("Google recusou a autenticação ({}): {}", status, body);
    }

    let token: TokenResponse = serde_json::from_str(&body)
        .with_context(|| format!("Resposta inesperada do token endpoint: {}", body))?;

    Ok(token.access_token)
}

/// Faz append de uma linha na planilha via Sheets API v4.
pub async fn append_row(
    google: &GoogleConfig,
    access_token: &str,
    result: &SpeedtestResult,
) -> Result<()> {
    let url = format!(
        "https://sheets.googleapis.com/v4/spreadsheets/{}/values/{}:append",
        google.spreadsheet_id, google.sheet_range
    );

    let body = serde_json::json!({
        "values": [result.as_row()]
    });

    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .bearer_auth(access_token)
        .query(&[
            ("valueInputOption", "USER_ENTERED"),
            ("insertDataOption", "INSERT_ROWS"),
        ])
        .json(&body)
        .send()
        .await
        .context("Falha ao chamar o Sheets API")?;

    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        bail!("Sheets API retornou erro ({}): {}", status, body);
    }

    Ok(())
}
