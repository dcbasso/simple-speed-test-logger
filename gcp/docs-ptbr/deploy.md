# Deploy — speedtest-logger GCP

## O que é feito no deploy

| Componente | Descrição |
|---|---|
| Cloud Function (`check-internet-status`) | Função Python que verifica o Firestore e envia alertas por Gmail |
| Cloud Scheduler job (`speedtest-monitor-scheduler`) | Dispara a função a cada 15 minutos |

---

## Pré-requisitos

Todos os passos de [pre-requisites.md](pre-requisites.md) devem estar concluídos antes do deploy:

- Projeto GCP criado e `gcloud` autenticado
- APIs habilitadas (Passo 2)
- Banco Firestore criado (Passo 3)
- Service Account criada com as roles corretas (Passo 5)
- Secrets do Gmail criados no Secret Manager (Passo 6)

---

## Executando o script de deploy

A partir da raiz do repositório:

```bash
bash gcp/server/deploy.sh
```

O script vai:
1. Fazer o deploy da Cloud Function (gen2, Python 3.11, trigger HTTP, somente autenticado)
2. Conceder permissão de invoker à Service Account na função
3. Criar ou atualizar o job do Cloud Scheduler (a cada 15 minutos)

> **Obs:** O primeiro deploy leva ~2 minutos. Re-deploys são mais rápidos.

---

## Configuração

Edite as variáveis no topo do arquivo [gcp/server/deploy.sh](../server/deploy.sh) antes de executar:

| Variável | Padrão | Descrição |
|---|---|---|
| `PROJECT_ID` | `REDACTED_PROJECT_ID` | ID do seu projeto GCP |
| `REGION` | `southamerica-east1` | Deve ser a mesma região do Firestore (Passo 3) |
| `ALERT_EMAIL` | `dcbasso@gmail.com` | Email que recebe alertas de queda/recuperação |
| `TIMEZONE` | `America/Sao_Paulo` | Fuso horário do Scheduler |
| `SCHEDULE` | `*/15 * * * *` | Expressão cron (a cada 15 min) |

---

## Teste manual

Após o deploy, dispare a função imediatamente para verificar se tudo funciona:

```bash
gcloud scheduler jobs run speedtest-monitor-scheduler \
  --project=REDACTED_PROJECT_ID \
  --location=southamerica-east1
```

Em seguida, veja os logs da função:

```bash
gcloud functions logs read check-internet-status \
  --gen2 \
  --project=REDACTED_PROJECT_ID \
  --region=us-east1 \
  --limit=50
```

---

## Configuração inicial no Firestore (opcional)

Por padrão a função usa a variável de ambiente `ALERT_EMAIL` e o limite de 45 minutos.
Para configurar via Firestore (permite alterar sem refazer o deploy), crie o documento de configuração:

No console GCP: **Firestore → coleção `monitor_config` → documento `current`** com os campos:

| Campo | Tipo | Exemplo |
|---|---|---|
| `alert_email` | string | `dcbasso@gmail.com` |
| `max_minutes_without_data` | number | `45` |

---

## Re-deploy após mudanças no código

Execute o mesmo script novamente — ele atualiza a função e o job existentes:

```bash
bash gcp/server/deploy.sh
```

---

## Remover os recursos

Para deletar tudo que foi deployado:

```bash
gcloud scheduler jobs delete speedtest-monitor-scheduler \
  --project=REDACTED_PROJECT_ID --location=southamerica-east1

gcloud functions delete check-internet-status \
  --gen2 --project=REDACTED_PROJECT_ID --region=us-east1
```
