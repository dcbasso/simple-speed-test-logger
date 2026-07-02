# Tela: Dashboard

## Objetivo

Visualizar o histórico de medições de velocidade com gráficos e métricas agregadas, filtrados por intervalo de datas.

---

## Layout

```
┌──────────────────────────────────────────────────────────────┐
│ speedtest-logger         [Dashboard] [Incidentes] [Config]  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Período: [Últimas 24h ▼]  De: [__/__/____] Até:[__/__/____]│
│                                                 [Aplicar]   │
├──────────────────────────────────────────────────────────────┤
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐         │
│  │ Download avg │ │  Upload avg  │ │   Ping avg   │         │
│  │  XX.X Mbps  │ │  XX.X Mbps  │ │    XX ms     │         │
│  └──────────────┘ └──────────────┘ └──────────────┘         │
│  ┌──────────────┐ ┌──────────────┐                          │
│  │  Jitter avg  │ │ Packet Loss  │                          │
│  │    X.X ms   │ │    X.XX %    │                          │
│  └──────────────┘ └──────────────┘                          │
├──────────────────────────────────────────────────────────────┤
│  Download & Upload (Mbps)                                    │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  [gráfico de linha — download azul, upload verde]     │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  Ping & Jitter (ms)                                          │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  [gráfico de linha — ping laranja, jitter cinza]      │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  Packet Loss (%)                                             │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  [gráfico de barras — vermelho quando > 0]            │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## Componentes Angular

| Componente | Lib | Detalhe |
|---|---|---|
| Navbar | `mat-toolbar` | Links para as outras telas |
| Filtro de período | `mat-select` + `mat-datepicker` | Presets: 6h, 24h, 7d, 30d, Custom |
| Cards de métricas | `mat-card` | 5 cards: download, upload, ping, jitter, packet loss |
| Gráfico download/upload | `ngx-charts-line-chart` | Duas séries, eixo X = tempo |
| Gráfico ping/jitter | `ngx-charts-line-chart` | Duas séries |
| Gráfico packet loss | `ngx-charts-bar-vertical` | Cor condicional (vermelho se > 0) |

---

## Filtro de Período

| Opção | Comportamento |
|---|---|
| Últimas 6h | `now - 6h` até `now` |
| Últimas 24h | `now - 24h` até `now` (padrão ao abrir) |
| Últimos 7 dias | `now - 7d` até `now` |
| Últimos 30 dias | `now - 30d` até `now` |
| Personalizado | Habilita os campos De / Até com datepicker |

Ao clicar em "Aplicar" (ou ao selecionar um preset): recarrega os dados do Firestore com o novo intervalo.

---

## Métricas nos Cards

Calculadas no frontend com base nos documentos retornados pelo filtro:

| Card | Cálculo |
|---|---|
| Download avg | média de `download_mbps` |
| Upload avg | média de `upload_mbps` |
| Ping avg | média de `ping_ms` |
| Jitter avg | média de `jitter_ms` |
| Packet Loss avg | média de `packet_loss_pct` |

Cada card também exibe min e max abaixo da média.

---

## Dados do Firestore

**Collection**: `speedtest_results`
**Query**:
```
where timestamp >= startDate
where timestamp <= endDate
orderBy timestamp ASC
```

Os documentos retornados alimentam tanto os cards quanto os gráficos.

---

## Estados da tela

| Estado | Exibição |
|---|---|
| Carregando | Skeleton nos cards e spinner nos gráficos |
| Sem dados no período | Mensagem: "Nenhum registro encontrado neste período" |
| Erro no Firestore | `mat-snack-bar` com mensagem de erro |
