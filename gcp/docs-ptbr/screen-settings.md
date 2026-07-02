# Tela: Configurações

## Objetivo

Permitir ajustar os parâmetros do monitor de internet sem precisar editar arquivos ou reimplantar código. As configurações são salvas no Firestore e lidas pela Cloud Function a cada execução.

---

## Layout

```
┌──────────────────────────────────────────────────────────────┐
│ speedtest-logger         [Dashboard] [Incidentes] [Config]  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Configurações do Monitor                                    │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Verificação de status                                 │  │
│  │                                                        │  │
│  │  Intervalo de checagem (minutos)                       │  │
│  │  [  15  ]                                              │  │
│  │  Mínimo: 5 min   Máximo: 60 min                       │  │
│  │                                                        │  │
│  │  Limiar para considerar internet caída (minutos)       │  │
│  │  [  45  ]                                              │  │
│  │  Deve ser maior que o intervalo de checagem            │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Notificações por email                                │  │
│  │                                                        │  │
│  │  Email de destino                                      │  │
│  │  [  seuemail@gmail.com                    ]            │  │
│  │                                                        │  │
│  │  [ ] Enviar email ao detectar queda                    │  │
│  │  [ ] Enviar email ao recuperar internet                │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│                              [Cancelar]  [Salvar]           │
│                                                              │
│  Última atualização: 22/06/2026 às 13:45                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Componentes Angular

| Componente | Lib | Detalhe |
|---|---|---|
| Navbar | `mat-toolbar` | |
| Seção "Verificação" | `mat-card` | Agrupa campos de intervalo e limiar |
| Campo intervalo | `mat-form-field` + `input[type=number]` | Validação: min 5, max 60 |
| Campo limiar | `mat-form-field` + `input[type=number]` | Validação: deve ser > intervalo |
| Seção "Notificações" | `mat-card` | Agrupa email e toggles |
| Campo email | `mat-form-field` + `input[type=email]` | Validação de formato de email |
| Toggle queda | `mat-slide-toggle` | Habilita/desabilita alerta de queda |
| Toggle recuperação | `mat-slide-toggle` | Habilita/desabilita alerta de recuperação |
| Botão Salvar | `mat-raised-button` color="primary" | Desabilitado se formulário inválido |
| Botão Cancelar | `mat-button` | Restaura os valores atuais do Firestore |
| Última atualização | `<p>` | Exibe `updated_at` do documento |

---

## Validações do Formulário

| Campo | Regra |
|---|---|
| Intervalo de checagem | Obrigatório, inteiro, entre 5 e 60 |
| Limiar de queda | Obrigatório, inteiro, maior que o intervalo |
| Email | Obrigatório, formato válido de email |

O botão "Salvar" permanece desabilitado enquanto o formulário for inválido ou não tiver alterações.

---

## Comportamento ao Salvar

1. Valida o formulário (Angular Reactive Forms)
2. Exibe spinner no botão "Salvar"
3. Escreve no Firestore `monitor_config/current`:
   ```json
   {
     "check_interval_minutes": 15,
     "max_minutes_without_data": 45,
     "alert_email": "seuemail@gmail.com",
     "notify_on_down": true,
     "notify_on_recovery": true,
     "updated_at": "<Timestamp>"
   }
   ```
4. Exibe `mat-snack-bar` de sucesso: _"Configurações salvas com sucesso"_
5. Atualiza o campo "Última atualização"

Em caso de erro: `mat-snack-bar` de erro com mensagem.

---

## Comportamento ao Carregar

1. Ao entrar na tela: busca `monitor_config/current` no Firestore
2. Preenche o formulário com os valores atuais
3. Se o documento não existir (primeira vez): usa valores padrão

| Campo | Valor padrão |
|---|---|
| check_interval_minutes | 15 |
| max_minutes_without_data | 45 |
| alert_email | `environment.allowedEmail` |
| notify_on_down | true |
| notify_on_recovery | true |

---

## Dados do Firestore

**Collection**: `monitor_config`
**Documento**: `current`

Leitura ao entrar na tela. Escrita ao clicar em "Salvar".

A Cloud Function lê este documento no início de cada execução para obter `max_minutes_without_data`, `alert_email`, `notify_on_down` e `notify_on_recovery`.

> O campo `check_interval_minutes` é informativo no dashboard — o intervalo real do Cloud Scheduler precisa ser ajustado manualmente no GCP Console ou via Terraform, pois o Scheduler não pode ser reconfigurado dinamicamente pelo Firestore.

---

## Estados da tela

| Estado | Exibição |
|---|---|
| Carregando config | Skeleton nos campos |
| Formulário sem alterações | Botão "Salvar" desabilitado |
| Formulário inválido | Erros inline nos campos + botão desabilitado |
| Salvando | Spinner no botão, campos desabilitados |
| Salvo com sucesso | `mat-snack-bar` verde |
| Erro ao salvar | `mat-snack-bar` vermelho |
