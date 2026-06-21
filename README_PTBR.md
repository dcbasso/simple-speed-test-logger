# speedtest-logger

Roda o `speedtest` (CLI oficial da Ookla) periodicamente via systemd timer e
registra cada resultado como uma linha numa Google Sheet, autenticando com
uma Service Account (sem fluxo de browser/OAuth manual).

## 1. Pré-requisitos no Linux

**Opção A — via repositório (Debian/Ubuntu):**
```bash
curl -s https://packagecloud.io/install/repositories/ookla/speedtest-cli/script.deb.sh | sudo bash
sudo apt-get install speedtest
```

> Se sua distro não for suportada (ex: Debian 13 Trixie / Proxmox VE 9), use a Opção B.

**Opção B — binário estático (funciona em qualquer distro):**
```bash
wget -O /tmp/speedtest.tgz "https://install.speedtest.net/app/cli/ookla-speedtest-1.2.0-linux-x86_64.tgz"
tar -xzf /tmp/speedtest.tgz -C /usr/local/bin speedtest
chmod +x /usr/local/bin/speedtest
```

**Aceitar a licença (obrigatório na primeira execução):**
```bash
speedtest --accept-license --accept-gdpr
```

## 2. Criar a Service Account no Google Cloud

1. Acesse https://console.cloud.google.com/ → crie um projeto (ou use um existente).
2. Ative a **Google Sheets API** (APIs & Services > Library > Sheets API > Enable).
3. Vá em **IAM & Admin > Service Accounts > Create Service Account**.
   - Se aparecer a pergunta *"What data will you be accessing?"*, escolha **Application data**
     (o app acessa a própria planilha via service account, não dados de um usuário Google).
   - Quando pedir para atribuir um **Role (papel)**, pule essa etapa (clique em Continue sem selecionar nada).
     O acesso à planilha é concedido compartilhando-a diretamente com o e-mail da service account
     (passo 3 abaixo), não via roles de IAM do projeto.
4. Após criar a service account, clique no nome dela na lista para abri-la.
5. Vá na aba **Keys** → **Add Key** → **Create new key** → selecione **JSON** → clique em **Create**.
   - Um arquivo `.json` será baixado automaticamente — esse é o seu `service-account.json`.
   - Guarde-o com segurança: ele contém credenciais privadas. Nunca suba para o git.
   - Esse arquivo vai no caminho configurado em `google.service_account_key_path` no `config.json`.
6. Abra o arquivo baixado e copie o valor de `"client_email"` (algo como
   `speedtest-logger@SEU-PROJETO.iam.gserviceaccount.com`). Você vai precisar dele no próximo passo.

## 3. Compartilhar a planilha com a Service Account

A Service Account não tem Google Drive próprio — ela só acessa o que for
explicitamente compartilhado com ela:

1. Crie uma planilha no Google Sheets.
2. Clique em **Compartilhar**, cole o `client_email` da service account,
   dê permissão de **Editor**.
3. Pegue o ID da planilha na URL:
   `https://docs.google.com/spreadsheets/d/AQUI_ESTA_O_ID/edit`
4. (Opcional) Na primeira linha da aba, crie os cabeçalhos:
   `timestamp | download_mbps | upload_mbps | ping_ms | jitter_ms | packet_loss_pct | server`

## 4. Configurar o projeto

Edite `config.json` com o ID da planilha e o caminho do
`service-account.json`. Veja o arquivo de exemplo na raiz do projeto.

## 5. Build

```bash
cargo build --release
sudo cp target/release/speedtest-logger /usr/local/bin/
```

## 6. Instalar como serviço systemd

```bash
sudo useradd --system --no-create-home speedtest-logger
sudo mkdir -p /etc/speedtest-logger
sudo cp config.json /etc/speedtest-logger/
sudo cp /caminho/para/service-account.json /etc/speedtest-logger/
sudo chown -R speedtest-logger:speedtest-logger /etc/speedtest-logger
sudo chmod 600 /etc/speedtest-logger/service-account.json

sudo cp systemd/speedtest-logger.service /etc/systemd/system/
sudo cp systemd/speedtest-logger.timer /etc/systemd/system/

# Ajuste o OnUnitActiveSec no .timer para bater com interval_minutes do config.json

sudo systemctl daemon-reload
sudo systemctl enable --now speedtest-logger.timer
```

## 7. Testar manualmente / ver logs

```bash
# Rodar uma vez na hora
sudo systemctl start speedtest-logger.service

# Ver logs
journalctl -u speedtest-logger.service -f

# Ver próximas execuções agendadas
systemctl list-timers speedtest-logger.timer
```

## Notas

- O timeout do speedtest é controlado por `speedtest.timeout_seconds` no
  config — se a internet estiver muito ruim ou o processo travar, ele é
  morto e a execução falha (fica registrada no journalctl, não na planilha).
- `interval_minutes` no config.json é só documentação/referência — quem
  controla o agendamento de fato é o `OnUnitActiveSec` no `.timer`. Se quiser,
  dá pra evoluir o binário com um subcomando que gera o `.timer`
  automaticamente a partir do config, pra não ter esse valor duplicado.
