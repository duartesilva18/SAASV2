# Google search: show "Finly" instead of "finlybot"

This doc summarises what’s in place and how to reinforce the brand name "Finly" in search results (app.finlybot.com).

---

## 1. Correct `<title>` example

- **Homepage:** `Finly - Gestão Financeira Pessoal | Telegram Bot`
- **Other pages (template):** `{Page title} | Finly`

The brand **Finly** is always at the end (or in the main title on the homepage) so Google tends to use it as the site name.

---

## 2. Meta tags (SEO + Open Graph)

Already set in `src/app/layout.tsx` (Next.js `metadata`):

| Tag / use | Value |
|-----------|--------|
| **Title** | `Finly - Gestão Financeira Pessoal \| Telegram Bot` |
| **Description** | Finly-focused (no “finlybot” as main name). |
| **applicationName** | `Finly` |
| **openGraph.siteName** | `Finly` |
| **openGraph.title** | `Finly - Gestão Financeira Pessoal \| Telegram Bot` |
| **openGraph.url** | `https://app.finlybot.com/` |
| **twitter:card** | `summary_large_image` |
| **twitter:title** | Same as OG title |
| **appleWebApp.title** | `Finly` |

Important for “site name” in Google: **title**, **applicationName**, **openGraph.siteName**, **appleWebApp.title** all use **Finly**.

---

## 3. JSON-LD structured data (Organization)

In the root layout, a global **Organization** block is output so the brand is clearly “Finly”:

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Finly",
  "url": "https://app.finlybot.com",
  "logo": "https://app.finlybot.com/images/logo/logo-semfundo.png",
  "description": "Finly - Gestão financeira pessoal e bot Telegram para registar despesas em segundos.",
  "sameAs": ["https://t.me/FinanZenApp_bot"]
}
```

The **SoftwareApplication** JSON-LD on the landing page uses `"name": "Finly"` and `"alternateName": ["Finly Bot", "finlybot"]` so the primary name is Finly.

---

## 4. Best practices to influence Google’s displayed site name

- **Use “Finly” consistently** in:
  - `metadata.title` (default + template)
  - `metadata.applicationName`
  - `openGraph.siteName` and `openGraph.title`
  - `appleWebApp.title`
  - PWA `manifest.json` (`name` / `short_name`) — already “Finly”.
- **Avoid promoting “finlybot”** in:
  - Main title
  - First sentence of meta description
  - OG/Twitter title and site name
- **Structured data:** Organization and SoftwareApplication both have `"name": "Finly"`.
- **Same brand everywhere:** Same logo URL and naming in JSON-LD, OG images, and app.

Google can still show the domain (e.g. “app.finlybot.com”) in some results; reinforcing “Finly” everywhere increases the chance it uses the brand name.

---

## 5. Steps to request reindexing (Google Search Console)

1. Go to [Google Search Console](https://search.google.com/search-console).
2. Select the property for **app.finlybot.com** (or the one that includes it).
3. **URL Inspection:**
   - Top bar: enter `https://app.finlybot.com`
   - Click **Enter**.
4. If the URL is “URL is not on Google” or you changed important content:
   - Click **Request indexing** (or “Solicitar indexação”).
5. For the homepage only, that’s enough. For more URLs, repeat for each important URL (e.g. `/auth/login`, `/pricing`).
6. **Sitemap (optional but recommended):**
   - In the left menu: **Sitemaps**.
   - Add sitemap URL if you have one (e.g. `https://app.finlybot.com/sitemap.xml`) and submit.
7. After deploying the metadata/JSON-LD changes, wait 1–2 days and request indexing again for `https://app.finlybot.com` so Google picks up the new “Finly” signals.

Reindexing is not instant; the displayed site name may take days or weeks to update.

---

## 6. Full `<head>` example (reference)

This is a **static HTML example** of the same idea. Your app uses Next.js `metadata` and the script in the body, so you don’t write `<head>` by hand; this is for comparison or non-Next.js use.

```html
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Finly - Gestão Financeira Pessoal | Telegram Bot</title>
  <meta name="description" content="Finly: regista despesas no Telegram em 3 segundos. Elimina a confusão das contas e ajuda-te a alcançar a paz financeira. Gráficos inteligentes, categorização automática e insights de IA. App finanças Portugal." />
  <meta name="application-name" content="Finly" />
  <meta name="author" content="Finly" />
  <link rel="canonical" href="https://app.finlybot.com/" />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://app.finlybot.com/" />
  <meta property="og:site_name" content="Finly" />
  <meta property="og:title" content="Finly - Gestão Financeira Pessoal | Telegram Bot" />
  <meta property="og:description" content="Finly: regista despesas no Telegram em 3 segundos. Elimina a confusão das contas e ajuda-te a alcançar a paz financeira." />
  <meta property="og:image" content="https://app.finlybot.com/og-image.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:locale" content="pt_PT" />

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Finly - Gestão Financeira Pessoal | Telegram Bot" />
  <meta name="twitter:description" content="Finly: regista despesas no Telegram em 3 segundos. Elimina a confusão das contas e paz financeira." />
  <meta name="twitter:image" content="https://app.finlybot.com/og-image.png" />
  <meta name="twitter:creator" content="@finlypt" />

  <!-- PWA / mobile -->
  <meta name="apple-mobile-web-app-title" content="Finly" />
  <link rel="manifest" href="/manifest.json" />

  <!-- JSON-LD Organization -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Finly",
    "url": "https://app.finlybot.com",
    "logo": "https://app.finlybot.com/images/logo/logo-semfundo.png",
    "description": "Finly - Gestão financeira pessoal e bot Telegram para registar despesas em segundos.",
    "sameAs": ["https://t.me/FinanZenApp_bot"]
  }
  </script>
</head>
```

---

## Summary of code changes made

- **`src/app/layout.tsx`**
  - Default description and OG/Twitter descriptions no longer lead with “finlybot”; they lead with “Finly”.
  - Added `applicationName: "Finly"`.
  - Added global **Organization** JSON-LD (output in body).
- **`src/app/page.tsx`**
  - SoftwareApplication JSON-LD: primary `name` remains `"Finly"`, `alternateName` reordered to `["Finly Bot", "finlybot"]`.

After deploy, use Google Search Console to request indexing of `https://app.finlybot.com` so Google picks up the new “Finly” branding.
