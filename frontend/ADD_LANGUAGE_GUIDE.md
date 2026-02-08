# 🌍 Guia: Como Adicionar um Novo Idioma

Este guia explica como adicionar um novo idioma ao Finly de forma simples e dinâmica.

## 📋 Passos para Adicionar um Novo Idioma

### 1. Adicionar Configuração do Idioma

Edite `src/lib/languages.ts` e adicione o novo idioma no objeto `SUPPORTED_LANGUAGES`:

```typescript
export const SUPPORTED_LANGUAGES: Record<string, LanguageConfig> = {
  pt: { /* ... */ },
  en: { /* ... */ },
  // Adicione o novo idioma aqui:
  fr: {
    code: 'fr',                    // Código ISO 639-1
    name: 'French',                 // Nome em inglês
    nativeName: 'Français',         // Nome no próprio idioma
    locale: 'fr-FR',                // Locale para formatação
    flag: '🇫🇷',                    // Emoji da bandeira
    currency: 'EUR',                // Moeda padrão
  },
};
```

### 2. Adicionar Traduções

Edite `src/lib/translations.ts` e adicione o objeto de traduções completo:

```typescript
export const translations = {
  pt: { /* ... */ },
  en: { /* ... */ },
  fr: {
    nav: {
      login: "J'ai déjà un compte",
      register: "Commencer gratuitement"
    },
    hero: {
      badge: "+2 800 français en contrôle total",
      title1: "Votre ",
      titleAccent: "paix financière",
      title2: " commence par un SMS.",
      description: "Finly élimine la confusion des comptes...",
      cta: "Essayer gratuitement"
    },
    // ... continue com todas as traduções necessárias
  },
};
```

**⚠️ Importante:** O objeto de traduções deve ter a mesma estrutura que `pt` e `en`. Copie a estrutura completa e traduza todos os campos.

### 3. Verificar Moedas Suportadas (Opcional)

Se o novo idioma usar uma moeda diferente, adicione-a em `SUPPORTED_CURRENCIES`:

```typescript
export const SUPPORTED_CURRENCIES = ['EUR', 'USD', 'BRL', 'CHF'] as const;
```

### 4. Testar

1. Reinicie o servidor de desenvolvimento
2. Vá a **Definições** → **Preferências** → **Idioma**
3. O novo idioma deve aparecer automaticamente no dropdown
4. Selecione o idioma e verifique se todas as traduções aparecem corretamente

## ✅ O Que Acontece Automaticamente

Uma vez adicionado o idioma em `languages.ts` e `translations.ts`:

- ✅ Aparece automaticamente no seletor de idioma
- ✅ É detectado automaticamente pelo browser (se configurado)
- ✅ Formatação de moeda ajusta-se ao locale
- ✅ Todas as páginas usam as traduções automaticamente
- ✅ Persiste a escolha do utilizador no localStorage

## 📝 Estrutura de Traduções

A estrutura completa de traduções inclui:

- `nav` - Navegação
- `hero` - Página principal
- `pricing` - Planos e preços
- `stats` - Estatísticas
- `steps` - Passos de onboarding
- `testimonials` - Depoimentos
- `footer` - Rodapé
- `cookies` - Banner de cookies
- `resources` - Recursos
- `faq` - Perguntas frequentes
- `auth` - Autenticação (login, registo, etc.)
- `dashboard` - Painel de controlo
- `onboarding` - Modal de onboarding
- E mais...

**Dica:** Use a estrutura de `pt` ou `en` como template e traduza campo por campo.

## Exemplo Completo: Francês

### 1. `languages.ts`:
```typescript
fr: {
  code: 'fr',
  name: 'French',
  nativeName: 'Français',
  locale: 'fr-FR',
  flag: '🇫🇷',
  currency: 'EUR',
},
```

### 2. `translations.ts`:
```typescript
fr: {
  nav: {
    login: "J'ai déjà un compte",
    register: "Commencer gratuitement"
  },
  // ... resto das traduções
},
```

## 🔍 Verificação de Traduções Faltantes

O sistema tem fallback automático: se uma tradução não existir, usa o idioma padrão (português) e mostra um aviso no console.

## 💡 Dicas

- Use ferramentas de tradução (Google Translate, DeepL) como base, mas revise sempre
- Mantenha a consistência de tom e estilo
- Teste todas as páginas após adicionar um novo idioma
- Considere contratar um tradutor nativo para qualidade profissional

## 📚 Recursos

- [ISO 639-1 Language Codes](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes)
- [Locale Codes](https://www.science.co.il/language/Locale-codes.php)
- [Currency Codes (ISO 4217)](https://en.wikipedia.org/wiki/ISO_4217)

