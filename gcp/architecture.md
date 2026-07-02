# speedtest-logger — Versão GCP

## Objetivo

Migrar o monitor de internet para infraestrutura GCP, mantendo a medição real da conexão local mas substituindo Google Sheets + Apps Script por Firestore + Cloud Functions + Gmail API. Inclui dashboard web com autenticação, gráficos, filtros e gestão de incidentes.

---

## Stack de Linguagens

### `gcp/client/` — Rust
Binário que roda na máquina local. Executa o speedtest CLI e envia os resultados para o Firestore via REST API.

- **Linguagem**: Rust (mesma base do `/src` atual)
- **Mudança principal**: trocar `sheets.rs` por `firestore.rs`
- **Auth**: Service Account JWT RS256 (mesmo padrão atual, scope diferente)

### `gcp/server/function/` — Python 3.12
Cloud Function que roda no GCP, verificando periodicamente se há dados novos e disparando alertas de email.

- **Linguagem**: Python 3.12
- **Runtime**: Google Cloud Functions (Gen 2)
- **Trigger**: Cloud Scheduler via HTTP (a cada 15 min)
- **Libs**: `google-cloud-firestore`, `google-auth`, `google-api-python-client`

### `gcp/server/web/` — TypeScript + Angular
SPA hospedada no Firebase Hosting. Lê dados do Firestore diretamente do browser via Firebase SDK. Sem backend adicional para o dashboard.

- **Linguagem**: TypeScript
- **Framework**: Angular 18+
- **Hosting**: Firebase Hosting (free tier)
- **Auth**: Firebase Authentication — Google Sign-In (restrito ao email do dono)
- **Banco**: Firestore (client SDK via `@angular/fire`, sem API intermediária)
- **Gráficos**: ngx-charts
- **UI**: Angular Material
- **Build**: Angular CLI

---

## Arquitetura

```
[Máquina local]                         [GCP / Firebase]
 gcp/client/ (Rust)                      Firestore
  └─ executa speedtest CLI    ──────►    collection: speedtest_results
  └─ envia resultado REST                collection: monitor_state
                                         collection: monitor_config
                                         │
                                    Cloud Scheduler (a cada N min)
                                         │
                              gcp/server/function/ (Python)
                                         └─ Gmail API → email alerta/recuperação
                                         │
                              gcp/server/web/ (React + TypeScript)
                                         └─ Firebase Hosting (CDN)
                                         └─ Firebase Auth (Google Sign-In)
                                         └─ Lê Firestore direto (client SDK)
```

### Componentes

| Componente | Pasta | Linguagem | Hospedagem |
|---|---|---|---|
| Local agent | `gcp/client/` | Rust | Máquina local |
| Monitor function | `gcp/server/function/` | Python 3.12 | Cloud Functions |
| Dashboard web | `gcp/server/web/` | TypeScript + Angular | Firebase Hosting |
| Storage | — | — | Firestore (managed) |
| Agendamento | — | — | Cloud Scheduler (managed) |
| Email | — | — | Gmail API |

---

## Dashboard Web — Telas

### 1. Login
- Botão "Entrar com Google"
- Firebase Auth restringe ao email configurado (`ALLOWED_EMAIL`)
- Qualquer outro email recebe erro de acesso negado

### 2. Dashboard Principal
- **Filtro**: seletor de intervalo de datas + time range (ex: últimas 24h, 7 dias, custom)
- **Gráficos** (Recharts, linha do tempo):
  - Download Mbps ao longo do tempo
  - Upload Mbps ao longo do tempo
  - Ping (ms) ao longo do tempo
  - Packet loss (%) ao longo do tempo
- **Cards de métricas médias** (calculadas com base no filtro ativo):
  - Média download / upload / ping / jitter / packet loss
  - Mínimo e máximo de cada métrica

### 3. Incidentes
- Lista de períodos onde `internet_down == true` (lidos do `monitor_state` histórico)
- Cada incidente mostra: início, fim, duração total
- Resumo: total de incidentes no período, tempo total offline

### 4. Configurações
- Intervalo de verificação de status (minutos) — atualiza `monitor_config/current` no Firestore
- Email de destino para alertas
- Limiar de minutos sem dados para considerar queda (padrão: 45)
- A Cloud Function lê essas configs do Firestore a cada execução

---

## Firestore — Modelo de Dados

### Collection `speedtest_results`
```json
{
  "timestamp": "Timestamp",
  "download_mbps": "number",
  "upload_mbps": "number",
  "ping_ms": "number",
  "jitter_ms": "number",
  "packet_loss_pct": "number",
  "server": "string",
  "isp": "string",
  "external_ip": "string",
  "result_url": "string"
}
```

### Collection `monitor_state` — Documento `current`
```json
{
  "internet_down": "boolean",
  "last_down_alert_at": "Timestamp | null",
  "last_recovery_alert_at": "Timestamp | null"
}
```

### Collection `incidents`
Criado pela Cloud Function ao detectar queda/recuperação (para exibir na tela de incidentes):
```json
{
  "started_at": "Timestamp",
  "recovered_at": "Timestamp | null",
  "duration_minutes": "number | null"
}
```

### Collection `monitor_config` — Documento `current`
Configurável pela tela de Settings do dashboard:
```json
{
  "check_interval_minutes": "number",
  "alert_email": "string",
  "max_minutes_without_data": "number"
}
```

---

## Componente Local (Rust) — Mudanças

### O que muda
- **Remove**: `sheets.rs`
- **Adiciona**: `firestore.rs` — POST para Firestore REST API
- **Config**: troca `spreadsheet_id` / `sheet_range` por `project_id` / `collection`
- **Auth scope**: `https://www.googleapis.com/auth/datastore`

### Endpoint Firestore REST
```
POST https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents/speedtest_results
```

### config.json (nova versão)
```json
{
  "interval_minutes": 15,
  "speedtest": {
    "binary_path": "speedtest",
    "timeout_seconds": 60
  },
  "gcp": {
    "service_account_key_path": "/etc/speedtest-logger/service-account.json",
    "project_id": "SEU_PROJECT_ID",
    "collection": "speedtest_results"
  },
  "log": {
    "path": "/var/log/speedtest-logger.log",
    "level": "info"
  }
}
```

---

## Cloud Function — `check-internet-status`

**Trigger**: Cloud Scheduler (HTTP) — intervalo lido do `monitor_config/current`

**Lógica**:
```
1. Lê monitor_config/current (limiar, email)
2. Busca último documento de speedtest_results (timestamp DESC, limit 1)
3. Calcula diff em minutos
4. Lê monitor_state/current
5. Se diff > limiar:
     Se internet_down == false → cria doc em incidents + envia email "caiu" + atualiza state
6. Se diff <= limiar:
     Se internet_down == true → atualiza incidents (recovered_at) + envia email "voltou" + atualiza state
```

**Variáveis de ambiente**:
- `GCP_PROJECT_ID`
- `ALLOWED_EMAIL` (fallback se config não estiver no Firestore ainda)

---

## Firebase Hosting — Web

**Deploy**:
```bash
cd gcp/server/web
npm run build
firebase deploy --only hosting
```

**Firebase Auth — restringir a um email**:
```typescript
// Após login, verificar se é o email permitido
if (user.email !== environment.allowedEmail) {
  await signOut(this.auth);
  throw new Error("Acesso negado");
}
```

---

## Service Account — Permissões

| Papel | Para quê |
|---|---|
| `roles/datastore.user` | Client Rust: escrever em speedtest_results |
| `roles/datastore.user` | Cloud Function: ler/escrever em todas as collections |
| `roles/cloudfunctions.invoker` | Cloud Scheduler invocar a função |

Gmail: a função usa **impersonation via Service Account** com Domain-Wide Delegation, ou OAuth2 refresh token armazenado no Secret Manager.

---

## Documentação de Telas

Cada tela tem seu próprio arquivo em `/gcp/docs/`:

| Arquivo | Tela |
|---|---|
| [docs/pre-requisites.md](docs/pre-requisites.md) | Setup GCP passo a passo (pt-BR + en) |
| [docs/screen-login.md](docs/screen-login.md) | Login com Google |
| [docs/screen-dashboard.md](docs/screen-dashboard.md) | Dashboard principal (gráficos + métricas) |
| [docs/screen-incidents.md](docs/screen-incidents.md) | Histórico de incidentes |
| [docs/screen-settings.md](docs/screen-settings.md) | Configurações do monitor |

---

## Estrutura de Arquivos (pasta `/gcp`)

```
gcp/
├── CLAUDE.md                        # convenções e regras para o Claude Code
├── architecture.md                  # este arquivo — stack, modelo de dados, estrutura
├── docs/
│   ├── pre-requisites.md            # setup GCP passo a passo (pt-BR + en)
│   ├── screen-login.md
│   ├── screen-dashboard.md
│   ├── screen-incidents.md
│   └── screen-settings.md
├── tasks/                           # tickets de implementação por entregável
│   ├── 01-rust-client.md
│   ├── 02-python-function.md
│   ├── 03-angular-setup.md
│   ├── 04-screen-login.md
│   ├── 05-screen-dashboard.md
│   ├── 06-screen-incidents.md
│   ├── 07-screen-settings.md
│   └── 08-terraform.md
├── client/                          # Rust — roda localmente
│   ├── Cargo.toml
│   ├── config.json.example
│   └── src/
│       ├── main.rs
│       ├── config.rs
│       ├── speedtest.rs             # igual ao /src/speedtest.rs atual
│       └── firestore.rs             # substitui sheets.rs
└── server/                          # tudo no GCP
    ├── function/                    # Cloud Function (Python)
    │   ├── main.py
    │   ├── requirements.txt
    │   └── .env.example
    ├── web/                         # Dashboard (Angular + TypeScript)
    │   ├── package.json
    │   ├── angular.json
    │   ├── tsconfig.json
    │   ├── .firebaserc
    │   ├── firebase.json
    │   └── src/
    │       ├── main.ts
    │       ├── app/
    │       │   ├── app.config.ts        # providers: Firebase, Router
    │       │   ├── app.routes.ts
    │       │   ├── core/
    │       │   │   ├── auth.guard.ts
    │       │   │   ├── auth.service.ts
    │       │   │   └── firestore.service.ts
    │       │   └── features/
    │       │       ├── login/
    │       │       ├── dashboard/
    │       │       ├── incidents/
    │       │       └── settings/
    │       └── environments/
    │           ├── environment.ts
    │           └── environment.prod.ts
    ├── terraform/
    └── deploy.sh
```

---

## Diferenças em relação à versão atual

| Aspecto | Versão atual | Versão GCP |
|---|---|---|
| Storage | Google Sheets | Firestore |
| Notificação | Apps Script (MailApp) | Cloud Function Python + Gmail API |
| Agendamento | Apps Script trigger | Cloud Scheduler |
| Estado do alerta | PropertiesService | Firestore `monitor_state` |
| Executor local | Rust → Sheets API | Rust → Firestore REST API |
| Dashboard | — | Angular SPA (Firebase Hosting) |
| Auth | — | Firebase Auth (Google Sign-In) |
| Incidentes | — | Collection `incidents` + tela dedicada |
| Configuração | config.json local | Firestore `monitor_config` + tela Settings |

---

## Decisões Fechadas

| Decisão | Escolha | Motivo |
|---|---|---|
| Service Account | **SA única** para client e Cloud Function | Projeto pessoal, complexidade desnecessária |
| Gmail auth | **OAuth2 refresh token** armazenado no Secret Manager | Simples, sem Google Workspace, fluxo one-time |
| Infra | **Terraform** | Reproduzível, versionado no git |
| Acesso ao dashboard | **Single user** — somente um email permitido | Sem perfis, sem gestão de usuários |

---

## Acesso Single-User

O dashboard não tem sistema de usuários. Apenas **um email** tem acesso, configurado em tempo de build via `environment.ts`. Qualquer outro email autenticado pelo Google é rejeitado imediatamente pelo `AuthService` e a sessão é encerrada.

```typescript
// environments/environment.prod.ts
export const environment = {
  allowedEmail: 'seuemail@gmail.com',  // único email com acesso
  // ...
};
```

Não há tela de cadastro, perfil, roles ou qualquer outro mecanismo de autorização além dessa verificação.

---

## Gmail — OAuth2 Refresh Token (one-time setup)

1. Criar credenciais OAuth2 do tipo **Desktop app** no GCP Console
2. Executar fluxo OAuth uma única vez localmente para obter o `refresh_token`
3. Armazenar `client_id`, `client_secret` e `refresh_token` no **Secret Manager**
4. A Cloud Function lê os secrets e obtém access tokens em tempo de execução

Sem dependência de Google Workspace. Sem Domain-Wide Delegation.

---

## Ordem de Implementação

1. **GCP setup**: criar projeto, habilitar APIs, Firestore, Firebase — ver `docs/pre-requisites.md`
2. **Gmail OAuth2**: fluxo one-time, armazenar refresh token no Secret Manager
3. **Terraform**: provisionar Cloud Function, Scheduler, Secret Manager, Firebase Hosting
4. **client/**: portar Rust (`firestore.rs`, `config.rs`)
5. **server/function/**: Cloud Function Python + Cloud Scheduler
6. **server/web/**: Angular — Login → Dashboard → Incidents → Settings
7. **Testes end-to-end**
