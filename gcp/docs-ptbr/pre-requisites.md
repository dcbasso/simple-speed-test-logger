# Pré-requisitos — speedtest-logger GCP

## O que você vai precisar

- Conta Google (Gmail pessoal serve)
- [Google Cloud CLI (`gcloud`)](https://cloud.google.com/sdk/docs/install) instalado
- [Firebase CLI (`firebase`)](https://firebase.google.com/docs/cli#install_the_firebase_cli) instalado
- [Terraform](https://developer.hashicorp.com/terraform/install) instalado
- [Node.js 20+](https://nodejs.org/) instalado (para o Angular)
- [Rust](https://rustup.rs/) instalado (para o client local)

---

### Passo 1 — Criar o projeto GCP

1. Acesse [console.cloud.google.com](https://console.cloud.google.com)
2. Clique em **Select a project → New Project**
3. Dê um nome (ex: `speedtest-monitor`) e anote o **Project ID** gerado
4. Clique em **Create**
5. Selecione o projeto criado como projeto ativo

No terminal:
```bash
gcloud auth login
gcloud config set project SEU_PROJECT_ID
```

---

### Passo 2 — Habilitar as APIs necessárias

```bash
gcloud services enable \
  firestore.googleapis.com \
  cloudfunctions.googleapis.com \
  cloudscheduler.googleapis.com \
  secretmanager.googleapis.com \
  gmail.googleapis.com \
  firebase.googleapis.com \
  identitytoolkit.googleapis.com
```

---

### Passo 3 — Criar o banco Firestore

1. No console GCP, vá em **Firestore**
2. Clique em **Create Database**
3. Selecione **Native mode** (não Datastore mode)
4. Escolha a região mais próxima (ex: `us-east1` ou `southamerica-east1`)
5. Clique em **Create**

---

### Passo 4 — Configurar o Firebase

1. Acesse [console.firebase.google.com](https://console.firebase.google.com)
2. Clique em **Add project → selecione o projeto GCP já criado**
3. Siga o wizard (pode desabilitar Google Analytics se quiser)
4. No menu lateral, vá em **Authentication → Get started**
5. Em **Sign-in method**, habilite **Google**
6. Configure o **Project support email** com o seu email
7. Clique em **Save**

---

### Passo 5 — Criar a Service Account

```bash
# Criar a SA
gcloud iam service-accounts create speedtest-sa \
  --display-name="speedtest-logger Service Account"

# Conceder permissões no Firestore
gcloud projects add-iam-policy-binding SEU_PROJECT_ID \
  --member="serviceAccount:speedtest-sa@SEU_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/datastore.user"

# Conceder permissão para invocar Cloud Functions (Cloud Scheduler)
gcloud projects add-iam-policy-binding SEU_PROJECT_ID \
  --member="serviceAccount:speedtest-sa@SEU_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudfunctions.invoker"

# Conceder acesso ao Secret Manager
gcloud projects add-iam-policy-binding SEU_PROJECT_ID \
  --member="serviceAccount:speedtest-sa@SEU_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Gerar e baixar a chave JSON (usada pelo client Rust local)
gcloud iam service-accounts keys create ~/speedtest-sa-key.json \
  --iam-account="speedtest-sa@SEU_PROJECT_ID.iam.gserviceaccount.com"
```

Mova o arquivo para um local seguro:
```bash
sudo mkdir -p /etc/speedtest-logger
sudo mv ~/speedtest-sa-key.json /etc/speedtest-logger/service-account.json
sudo chmod 600 /etc/speedtest-logger/service-account.json
```

---

### Passo 6 — Configurar Gmail OAuth2 (one-time)

#### 6.1 — Criar credenciais OAuth2

> **Nota:** O Google reorganizou a interface OAuth. Os passos abaixo refletem a interface atual do **Google Auth Platform**. Se você ver o layout antigo em **APIs & Services → Credentials**, as opções são equivalentes.

1. No console GCP, vá em **Google Auth Platform → Clients**
   - Se solicitado a configurar a consent screen primeiro, preencha as seções do menu lateral:
     - **Branding**: nome do app (`speedtest-logger`), e-mail de suporte
     - **Audience**: User type **External**
     - **Data Access → Add or remove scopes**: adicione `https://www.googleapis.com/auth/gmail.send`
     - **Audience → Test users**: adicione o seu e-mail
2. Clique em **Create client**
3. Application type: **Desktop app**
4. Clique em **Create** e anote o **Client ID** e o **Client Secret** (ou baixe o arquivo JSON)

#### 6.2 — Obter o refresh token (executar uma única vez)

Instale a biblioteca Python usando `pipx` (gerencia o ambiente virtual automaticamente, sem poluir o sistema):
```bash
pipx install google-auth-oauthlib
```

> Se `pipx` não estiver instalado: `sudo apt install pipx && pipx ensurepath`

Execute o script abaixo localmente (substitua os valores):
```python
from google_auth_oauthlib.flow import InstalledAppFlow

flow = InstalledAppFlow.from_client_secrets_file(
    'client_secret.json',  # arquivo baixado no passo anterior
    scopes=['https://www.googleapis.com/auth/gmail.send']
)
creds = flow.run_local_server(port=0)
print("refresh_token:", creds.refresh_token)
```

Anote o `refresh_token` exibido no terminal.

#### 6.3 — Armazenar no Secret Manager

```bash
# Client ID
echo -n "SEU_CLIENT_ID" | \
  gcloud secrets create gmail-client-id --data-file=-

# Client Secret
echo -n "SEU_CLIENT_SECRET" | \
  gcloud secrets create gmail-client-secret --data-file=-

# Refresh Token
echo -n "SEU_REFRESH_TOKEN" | \
  gcloud secrets create gmail-refresh-token --data-file=-
```

---

### Passo 7 — Configurar o email permitido no dashboard

O dashboard aceita somente **um email**. Essa configuração é feita no arquivo de ambiente do Angular antes do build:

```typescript
// gcp/server/web/src/environments/environment.prod.ts
export const environment = {
  allowedEmail: 'seuemail@gmail.com',  // substitua pelo seu email
  // demais configs do Firebase serão adicionadas aqui
};
```

---

### Passo 8 — Obter as configurações do Firebase para o Angular

1. No console Firebase, vá em **Project settings** (ícone de engrenagem)
2. Em **Your apps**, clique em **Add app → Web (`</>`)**
3. Registre o app com um apelido (ex: `speedtest-web`)
4. Copie o objeto `firebaseConfig` exibido
5. Cole em `environment.ts` e `environment.prod.ts`

```typescript
export const environment = {
  allowedEmail: 'seuemail@gmail.com',
  firebase: {
    apiKey: "...",
    authDomain: "...",
    projectId: "...",
    storageBucket: "...",
    messagingSenderId: "...",
    appId: "..."
  }
};
```

---

### Checklist final

- [ ] Projeto GCP criado e `gcloud` configurado com o Project ID correto
- [ ] APIs habilitadas (Passo 2)
- [ ] Firestore criado em Native mode
- [ ] Firebase configurado com Google Sign-In habilitado
- [ ] Service Account criada com roles corretas
- [ ] Chave JSON em `/etc/speedtest-logger/service-account.json`
- [ ] Secrets do Gmail criados no Secret Manager (`gmail-client-id`, `gmail-client-secret`, `gmail-refresh-token`)
- [ ] Email permitido configurado em `environment.prod.ts`
- [ ] `firebaseConfig` copiado para os arquivos de environment
