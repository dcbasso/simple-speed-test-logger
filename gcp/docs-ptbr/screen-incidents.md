# Tela: Incidentes

## Objetivo

Exibir o histórico de quedas de internet detectadas pelo monitor, com início, fim e duração de cada incidente.

---

## Layout

```
┌──────────────────────────────────────────────────────────────┐
│ speedtest-logger         [Dashboard] [Incidentes] [Config]  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Período: [Últimos 30 dias ▼]               [Aplicar]       │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  ┌───────────────────┐  ┌───────────────────┐               │
│  │  Total incidentes │  │ Tempo total offline│               │
│  │        X          │  │     Xh XXmin       │               │
│  └───────────────────┘  └───────────────────┘               │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  #  │  Início               │  Fim                 │ Duração │
│ ────┼───────────────────────┼──────────────────────┼──────── │
│  1  │  22/06/2026 13:30     │  22/06/2026 14:15    │ 45 min  │
│  2  │  20/06/2026 08:00     │  20/06/2026 08:52    │ 52 min  │
│  3  │  18/06/2026 21:10     │  Em andamento...     │  —      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Componentes Angular

| Componente | Lib | Detalhe |
|---|---|---|
| Navbar | `mat-toolbar` | |
| Filtro de período | `mat-select` + `mat-datepicker` | Mesmos presets do Dashboard |
| Cards de resumo | `mat-card` | Total de incidentes + tempo total offline |
| Tabela de incidentes | `mat-table` | Paginação com `mat-paginator` |
| Badge "Em andamento" | `mat-chip` vermelho | Quando `recovered_at == null` |

---

## Filtro de Período

Mesmos presets do Dashboard (6h, 24h, 7d, 30d, Custom). Filtra por `started_at` dentro do intervalo.

---

## Cards de Resumo

| Card | Cálculo |
|---|---|
| Total de incidentes | `count` dos documentos retornados |
| Tempo total offline | soma de `duration_minutes` (ignora incidentes em andamento) |

---

## Tabela

| Coluna | Campo Firestore | Formato |
|---|---|---|
| # | — | índice sequencial (1, 2, 3…) |
| Início | `started_at` | `dd/MM/yyyy HH:mm` (fuso local) |
| Fim | `recovered_at` | `dd/MM/yyyy HH:mm` ou badge "Em andamento" |
| Duração | `duration_minutes` | `Xh XXmin` ou `—` se em andamento |

Ordenação padrão: `started_at DESC` (mais recente primeiro).

Paginação: 10 itens por página.

---

## Dados do Firestore

**Collection**: `incidents`
**Query**:
```
where started_at >= startDate
where started_at <= endDate
orderBy started_at DESC
```

---

## Quem cria os documentos de incidente?

A **Cloud Function** (`check-internet-status`):
- Ao detectar queda: cria documento com `started_at = now`, `recovered_at = null`
- Ao detectar recuperação: atualiza o documento mais recente com `recovered_at = now` e `duration_minutes = diff`

---

## Estados da tela

| Estado | Exibição |
|---|---|
| Carregando | Spinner na tabela |
| Sem incidentes no período | Mensagem: "Nenhum incidente encontrado — tudo certo!" |
| Incidente em andamento | Linha destacada em vermelho claro com badge "Em andamento" |
| Erro no Firestore | `mat-snack-bar` com mensagem de erro |
