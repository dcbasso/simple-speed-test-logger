# googleAppScript — Monitor de Internet

Um Google Apps Script que monitora a conectividade com a internet verificando se o app Rust [speedtest-logger](../) está gravando dados na Google Sheet regularmente.

## Como funciona

O app Rust grava uma nova linha na planilha a cada 15 minutos — mas apenas quando há acesso à internet. O Apps Script roda a cada 30 minutos e verifica o timestamp da última linha:

- Se o último registro tiver **mais de 45 minutos** → internet provavelmente caiu → envia email de alerta
- Se o último registro voltar a ser **recente** → internet voltou → envia email de recuperação

O spam é evitado via `PropertiesService`, que persiste o estado entre execuções indefinidamente. Cada evento (queda / recuperação) dispara exatamente um email.

```
[Proxmox — a cada 15 min]          [Apps Script — a cada 30 min]
speedtest → grava na Sheet    →    lê timestamp da última linha
                                   se > 45 min atrás → envia alerta (uma vez)
                                   se recente novamente → envia recuperação (uma vez)
```

## Arquivos

| Arquivo | Descrição |
|---|---|
| `Code.gs` | Script principal de monitoramento |
| `appsscript.json` | Manifesto — timezone, escopos OAuth |

## Configuração

Edite as constantes no topo do `Code.gs`:

| Constante | Padrão | Descrição |
|---|---|---|
| `SHEET_NAME` | `"tests"` | Nome da aba da planilha |
| `ALERT_EMAIL` | `"dcbasso@gmail.com"` | Destinatário dos emails de alerta |
| `MAX_MINUTES_WITHOUT_DATA` | `45` | Limite em minutos para considerar a internet fora do ar |

## Planilha

Uma planilha de exemplo pronta para uso está disponível:
**[Abrir exemplo no Google Sheets](https://docs.google.com/spreadsheets/d/1RmNpQxL4VTGkR9y4J7pkdzm69i1FIRLB3RCZkara5lQ/edit?usp=sharing)**

> **Alternativa — formato xlsx:** Um arquivo `.xlsx` também está disponível neste repositório. Para usá-lo é necessário importar no Google Drive e converter para o formato nativo do Google Sheets (Arquivo → Salvar como Planilhas Google). Esse caminho é mais complexo e só é recomendado se precisar de uma cópia local do template.

## Setup

1. Abra a Google Sheet → **Extensões → Apps Script**
2. Substitua o conteúdo padrão do `Code.gs` pelo conteúdo do arquivo `Code.gs`
3. Nas configurações do editor, ative **"Mostrar arquivo de manifesto appsscript.json"** e substitua seu conteúdo pelo do arquivo `appsscript.json`
4. Adicione um acionador baseado em tempo:
   - **Acionadores → Adicionar acionador**
   - Função: `checkInternetStatus`
   - Origem do evento: **Baseado em tempo**
   - Tipo: **Temporizador de minutos → A cada 30 minutos**
5. Autorize as permissões solicitadas na primeira execução

## Utilitários

- **`resetState()`** — execute uma vez pelo editor para limpar o estado persistido de queda/recuperação (útil após testes)
