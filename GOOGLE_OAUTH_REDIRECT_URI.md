# Corrigir erro 400: redirect_uri_mismatch (Login com Google)

O erro **"Acesso bloqueado: a solicitação desta app é inválida"** e **"Error 400: redirect_uri_mismatch"** aparece quando o **redirect URI** usado no login com Google não está registado no Google Cloud Console.

## O que fazer

### 1. Abrir as credenciais OAuth

1. Abre [Google Cloud Console](https://console.cloud.google.com/)
2. Seleciona o projeto onde está o cliente OAuth (o mesmo do `GOOGLE_CLIENT_ID` / `NEXT_PUBLIC_GOOGLE_CLIENT_ID`)
3. Vai a **APIs & Services** → **Credentials**
4. Clica no **OAuth 2.0 Client ID** que usas para a app (tipo "Web application")

### 2. Adicionar os URIs corretos

No ecrã de edição do cliente OAuth:

#### **Authorized JavaScript origins**

Adiciona **exatamente** as origens onde a app corre (sem path, sem barra final):

- **Local:** `http://localhost:3000`  
  (Se usares outra porta, usa essa, ex.: `http://localhost:3001`.)
- **Produção (Render):** `https://finanzen-frontend.onrender.com`  
  (Ou o domínio que usas: `https://app.finlybot.com`, `https://finly.pt`, etc.)

#### **Authorized redirect URIs**

**Importante:** Cada domínio que aparece em "Authorized JavaScript origins" **tem de ter** os mesmos URIs aqui. Se a app corre em `app.finlybot.com`, precisas de `https://app.finlybot.com` (e paths) em **redirect URIs**, não só em JavaScript origins.

Mínimo para funcionar em todos os domínios onde testes:

- **Local:** `http://localhost:3000`, `http://localhost:3000/auth/login`, `http://localhost:3000/auth/register`
- **finanzen-frontend:** `https://finanzen-frontend.onrender.com`, `https://finanzen-frontend.onrender.com/auth/login`, `https://finanzen-frontend.onrender.com/auth/register`
- **app.finlybot.com:** `https://app.finlybot.com`, `https://app.finlybot.com/auth/login`, `https://app.finlybot.com/auth/register`

### 3. Regras importantes

- **Sem trailing slash** nas origens: `https://finanzen-frontend.onrender.com` e não `https://finanzen-frontend.onrender.com/`
- **Protocolo:** produção em `https://`, local em `http://`
- **Sem path em "Authorized JavaScript origins"** – só domínio + porta
- Em **Authorized redirect URIs** pode ser só a origem ou origem + path (ex.: `/auth/login`)

### 4. Guardar e testar

1. Clica em **Save**
2. Espera 1–2 minutos (a propagação às vezes atrasa)
3. Limpa cache/cookies do browser ou usa janela anónima
4. Tenta de novo o login com Google

---

## Resumo rápido (finanzen-frontend no Render)

| Onde testes | Authorized JavaScript origins | Authorized redirect URIs |
|------------|-------------------------------|---------------------------|
| Local      | `http://localhost:3000`       | `http://localhost:3000`   |
| Produção   | `https://finanzen-frontend.onrender.com` | `https://finanzen-frontend.onrender.com` |

Se usares outro domínio, substitui por esse (ex.: `https://finly.pt`).
