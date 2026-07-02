# Tela: Login

## Objetivo

Autenticar o usuário via Google Sign-In e garantir que apenas o email autorizado tenha acesso ao dashboard.

---

## Layout

```
┌─────────────────────────────────────────┐
│                                         │
│         speedtest-logger                │
│         Monitor de Internet             │
│                                         │
│   ┌─────────────────────────────────┐   │
│   │  G  Entrar com Google           │   │
│   └─────────────────────────────────┘   │
│                                         │
│   [mensagem de erro, se houver]         │
│                                         │
└─────────────────────────────────────────┘
```

---

## Componentes

| Elemento | Tipo Angular | Detalhe |
|---|---|---|
| Logo / título | `<h1>` estático | Nome do app |
| Botão Google | `mat-raised-button` | Ícone Google + texto "Entrar com Google" |
| Mensagem de erro | `mat-error` ou `<p>` condicional | Exibido apenas se houver erro |

---

## Comportamento

1. Usuário clica em "Entrar com Google"
2. Firebase abre popup de seleção de conta Google
3. Após autenticação bem-sucedida:
   - Verifica se `user.email === environment.allowedEmail`
   - **Se sim**: redireciona para `/dashboard`
   - **Se não**: faz `signOut()` imediatamente e exibe mensagem de erro: _"Acesso negado. Esta conta não tem permissão."_
4. Se o popup for fechado sem login: nenhuma ação

## Estado de carregamento

- Durante o popup aberto: botão fica desabilitado com spinner
- Se já existe sessão ativa (refresh de página): redireciona direto para `/dashboard` sem mostrar a tela de login

## Guard de rota

`AuthGuard` protege todas as rotas exceto `/login`. Redireciona para `/login` se não autenticado.

---

## Dados do Firestore

Nenhum. A tela de login não consome Firestore.

---

## Variáveis de ambiente necessárias

```typescript
// environment.ts
export const environment = {
  allowedEmail: 'seuemail@gmail.com',
  firebase: { /* config do Firebase */ }
};
```
