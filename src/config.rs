use anyhow::{Context, Result};
use serde::Deserialize;
use std::fs;
use std::path::Path;

#[derive(Debug, Deserialize, Clone)]
pub struct Config {
    pub interval_minutes: u32,
    pub speedtest: SpeedtestConfig,
    pub google: GoogleConfig,
    pub log: LogConfig,
}

#[derive(Debug, Deserialize, Clone)]
pub struct SpeedtestConfig {
    pub binary_path: String,
    pub timeout_seconds: u64,
}

#[derive(Debug, Deserialize, Clone)]
pub struct GoogleConfig {
    pub service_account_key_path: String,
    pub spreadsheet_id: String,
    pub sheet_range: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct LogConfig {
    pub path: String,
    pub level: String,
}

/// Estrutura do arquivo JSON de credenciais da Service Account
/// (exatamente como o Google Cloud Console gera ao criar a chave).
#[derive(Debug, Deserialize, Clone)]
pub struct ServiceAccountKey {
    pub client_email: String,
    pub private_key: String,
    #[serde(default = "default_token_uri")]
    pub token_uri: String,
}

fn default_token_uri() -> String {
    "https://oauth2.googleapis.com/token".to_string()
}

impl Config {
    pub fn load(path: &Path) -> Result<Self> {
        let raw = fs::read_to_string(path)
            .with_context(|| format!("Falha ao ler config em {:?}", path))?;
        let config: Config = serde_json::from_str(&raw)
            .with_context(|| "Falha ao parsear config.json")?;
        Ok(config)
    }
}

impl ServiceAccountKey {
    pub fn load(path: &str) -> Result<Self> {
        let raw = fs::read_to_string(path)
            .with_context(|| format!("Falha ao ler service account key em {}", path))?;
        let key: ServiceAccountKey = serde_json::from_str(&raw)
            .with_context(|| "Falha ao parsear service-account.json")?;
        Ok(key)
    }
}
