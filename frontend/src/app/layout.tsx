import type { Metadata } from "next";
import { Geist, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/LanguageContext";
import { UserProvider } from "@/lib/UserContext";
import { InstallPromptProvider } from "@/lib/InstallPromptContext";
import { ThemeProvider } from "@/lib/ThemeContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import CookieBanner from "@/components/CookieBanner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-brand",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.finlybot.com';

export const metadata: Metadata = {
  title: {
    default: "Finly - Gestão Financeira Pessoal | Telegram Bot",
    template: "%s | Finly"
  },
  description: "Finly: regista despesas no Telegram em 3 segundos. Elimina a confusão das contas e ajuda-te a alcançar a paz financeira. Gráficos inteligentes, categorização automática e insights de IA. App finanças Portugal.",
  keywords: [
    "Finly",
    "gestão financeira",
    "controlo de despesas",
    "telegram bot",
    "telegram bot finanças",
    "finanças pessoais",
    "orçamento",
    "poupança",
    "gestão de dinheiro",
    "app finanças",
    "Portugal"
  ],
  authors: [{ name: "Finly" }],
  creator: "Finly",
  publisher: "Finly",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(siteUrl),
  applicationName: "Finly",
  // Favicon em URL absoluta para evitar cache/redirecionamentos; browsers guardam ícone muito tempo
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.ico', sizes: '32x32', type: 'image/x-icon' },
    ],
    apple: '/images/logo/logo-semfundo.png',
    shortcut: '/favicon.ico',
  },
  alternates: {
    canonical: '/',
    languages: {
      'pt-PT': '/',
      'en': '/',
      'fr': '/',
    },
  },
  openGraph: {
    type: 'website',
    locale: 'pt_PT',
    alternateLocale: ['en_US', 'fr_FR'],
    url: '/',
    siteName: 'Finly',
    title: 'Finly - Gestão Financeira Pessoal | Telegram Bot',
    description: 'Finly: regista despesas no Telegram em 3 segundos. Elimina a confusão das contas e ajuda-te a alcançar a paz financeira.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Finly - Gestão Financeira Pessoal',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Finly - Gestão Financeira Pessoal | Telegram Bot',
    description: 'Finly: regista despesas no Telegram em 3 segundos. Elimina a confusão das contas e paz financeira.',
    images: ['/og-image.png'],
    creator: '@finlypt',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Finly",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  // Barra de estado no topo (PWA/telemóvel): escuro para combinar com a app em vez de azul
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Finly',
    url: siteUrl,
    logo: `${siteUrl}/images/logo/logo-semfundo.png`,
    description: 'Finly - Gestão financeira pessoal e bot Telegram para registar despesas em segundos.',
    sameAs: [
      'https://t.me/FinanZenApp_bot',
      ...(process.env.NEXT_PUBLIC_TWITTER_URL ? [process.env.NEXT_PUBLIC_TWITTER_URL] : []),
    ].filter(Boolean),
  };

  return (
    <html lang="pt-PT" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${plusJakarta.variable} antialiased overflow-x-hidden`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <ErrorBoundary>
          <ThemeProvider>
            <InstallPromptProvider>
              <LanguageProvider>
                <UserProvider>
                  {children}
                  <CookieBanner />
                </UserProvider>
              </LanguageProvider>
            </InstallPromptProvider>
          </ThemeProvider>
        </ErrorBoundary>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Handler para ChunkLoadError - recarrega automaticamente
              window.addEventListener('error', (event) => {
                if (event.message && event.message.includes('ChunkLoadError')) {
                  console.warn('ChunkLoadError detectado, a recarregar página...');
                  // Limpar cache e recarregar
                  if ('caches' in window) {
                    caches.keys().then(names => {
                      names.forEach(name => caches.delete(name));
                    });
                  }
                  window.location.reload();
                }
              });
              
              // Handler para erros de importação de módulos
              window.addEventListener('unhandledrejection', (event) => {
                if (event.reason && event.reason.message && event.reason.message.includes('Failed to fetch dynamically imported module')) {
                  console.warn('Erro de importação dinâmica detectado, a recarregar página...');
                  if ('caches' in window) {
                    caches.keys().then(names => {
                      names.forEach(name => caches.delete(name));
                    });
                  }
                  window.location.reload();
                }
              });
              
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(() => {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
