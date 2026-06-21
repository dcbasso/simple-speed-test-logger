mod config;
mod sheets;
mod speedtest;

use anyhow::Result;
use clap::Parser;
use std::path::PathBuf;
use tracing::{error, info};

#[derive(Parser, Debug)]
#[command(name = "speedtest-logger")]
#[command(about = "Roda um speedtest e registra o resultado numa Google Sheet")]
struct Args {
    /// Caminho para o config.json
    #[arg(short, long, default_value = "config.json")]
    config: PathBuf,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let args = Args::parse();
    let cfg = config::Config::load(&args.config)?;

    info!("Iniciando speedtest...");
    let result = match speedtest::run(&cfg.speedtest) {
        Ok(r) => r,
        Err(e) => {
            error!("Falha ao rodar speedtest: {:?}", e);
            return Err(e);
        }
    };

    info!(
        "Resultado: download={:.2} Mbps upload={:.2} Mbps ping={:.1} ms",
        result.download_mbps, result.upload_mbps, result.ping_ms
    );

    info!("Autenticando com a Service Account...");
    let token = sheets::get_access_token(&cfg.google).await?;

    info!("Enviando resultado para a planilha...");
    sheets::append_row(&cfg.google, &token, &result).await?;

    info!("Concluído com sucesso.");
    Ok(())
}
