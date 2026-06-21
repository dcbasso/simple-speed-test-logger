use crate::config::SpeedtestConfig;
use anyhow::{anyhow, bail, Context, Result};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use std::process::{Command, Stdio};
use std::sync::mpsc;
use std::thread;
use std::time::Duration;

/// Subconjunto do JSON retornado por `speedtest --format=json`
/// (CLI oficial da Ookla). Campos não usados são ignorados pelo serde.
#[derive(Debug, Deserialize)]
struct RawResult {
    #[serde(rename = "type")]
    result_type: String,
    ping: RawPing,
    download: RawTransfer,
    upload: RawTransfer,
    #[serde(rename = "packetLoss")]
    packet_loss: Option<f64>,
    isp: Option<String>,
    interface: Option<RawInterface>,
    server: RawServer,
    result: Option<RawResultLink>,
}

#[derive(Debug, Deserialize)]
struct RawPing {
    jitter: f64,
    latency: f64,
}

#[derive(Debug, Deserialize)]
struct RawTransfer {
    /// bytes por segundo
    bandwidth: u64,
}

#[derive(Debug, Deserialize)]
struct RawInterface {
    #[serde(rename = "externalIp")]
    external_ip: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RawServer {
    name: String,
    location: String,
    country: String,
}

#[derive(Debug, Deserialize)]
struct RawResultLink {
    url: Option<String>,
}

/// Resultado já convertido pra unidades legíveis (Mbps) e pronto
/// pra virar uma linha na planilha.
#[derive(Debug)]
pub struct SpeedtestResult {
    pub timestamp: DateTime<Utc>,
    pub download_mbps: f64,
    pub upload_mbps: f64,
    pub ping_ms: f64,
    pub jitter_ms: f64,
    pub packet_loss_pct: f64,
    pub server: String,
    pub isp: String,
    pub external_ip: String,
    pub result_url: String,
}

impl SpeedtestResult {
    /// Linha pronta para enviar ao Sheets API (append).
    pub fn as_row(&self) -> Vec<String> {
        vec![
            self.timestamp.to_rfc3339(),
            format!("{:.2}", self.download_mbps),
            format!("{:.2}", self.upload_mbps),
            format!("{:.1}", self.ping_ms),
            format!("{:.1}", self.jitter_ms),
            format!("{:.2}", self.packet_loss_pct),
            self.server.clone(),
        ]
    }
}

/// Executa o binário `speedtest` com timeout manual (sem depender de
/// crates extras pra isso) e retorna o resultado já parseado.
pub fn run(config: &SpeedtestConfig) -> Result<SpeedtestResult> {
    let mut child = Command::new(&config.binary_path)
        .args(["--format=json", "--accept-license", "--accept-gdpr"])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .with_context(|| format!("Falha ao iniciar '{}'. Está instalado e no PATH?", config.binary_path))?;

    let (tx, rx) = mpsc::channel();
    let pid = child.id();
    let timeout = Duration::from_secs(config.timeout_seconds);

    // Thread separada só pra esperar o processo terminar, sem travar
    // o fluxo principal além do timeout configurado.
    let wait_handle = thread::spawn(move || {
        let result = child.wait_with_output();
        let _ = tx.send(result);
    });

    let output = match rx.recv_timeout(timeout) {
        Ok(result) => result.context("Falha ao coletar saída do speedtest")?,
        Err(_) => {
            // Estourou o timeout: tenta matar o processo antes de desistir.
            let _ = Command::new("kill").arg("-9").arg(pid.to_string()).status();
            bail!(
                "speedtest excedeu o timeout de {} segundos",
                config.timeout_seconds
            );
        }
    };
    let _ = wait_handle.join();

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        bail!("speedtest retornou erro: {}", stderr.trim());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let raw: RawResult = serde_json::from_str(&stdout)
        .with_context(|| format!("Falha ao parsear JSON do speedtest: {}", stdout))?;

    if raw.result_type != "result" {
        return Err(anyhow!("speedtest não retornou um resultado final (type={})", raw.result_type));
    }

    let download_mbps = (raw.download.bandwidth as f64 * 8.0) / 1_000_000.0;
    let upload_mbps = (raw.upload.bandwidth as f64 * 8.0) / 1_000_000.0;
    let external_ip = raw
        .interface
        .and_then(|i| i.external_ip)
        .unwrap_or_else(|| "desconhecido".to_string());

    Ok(SpeedtestResult {
        timestamp: Utc::now(),
        download_mbps,
        upload_mbps,
        ping_ms: raw.ping.latency,
        jitter_ms: raw.ping.jitter,
        packet_loss_pct: raw.packet_loss.unwrap_or(0.0),
        server: format!("{} - {}, {}", raw.server.name, raw.server.location, raw.server.country),
        isp: raw.isp.unwrap_or_else(|| "desconhecido".to_string()),
        external_ip,
        result_url: raw.result.and_then(|r| r.url).unwrap_or_default(),
    })
}
