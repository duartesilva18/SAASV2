import type { Metadata } from "next";
import { Geist, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/LanguageContext";
import { UserProvider } from "@/lib/UserContext";
import { InstallPromptProvider } from "@/lib/InstallPromptContext";
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

export const metadata: Metadata = {
  title: {
    default: "Finly - Gestão Financeira Pessoal | Telegram Bot",
    template: "%s | Finly"
  },
  description: "Registe despesas no Telegram em 3 segundos. O Finly elimina a confusão das contas e ajuda-te a alcançar a paz financeira. Gráficos inteligentes, categorização automática e insights de IA.",
  keywords: [
    "gestão financeira",
    "controlo de despesas",
    "telegram bot",
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
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://app.finlybot.com'),
  // Favicon em URL absoluta para evitar cache/redirecionamentos; browsers guardam ícone muito tempo
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.ico', sizes: '32x32', type: 'image/x-icon' },
    ],
    // iOS não lida bem com ícones transparentes; usar versão com fundo
    apple: '/images/logo/icon.jpeg',
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
    description: 'Registe despesas no Telegram em 3 segundos. O Finly elimina a confusão das contas e ajuda-te a alcançar a paz financeira.',
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
    title: 'Finly - Gestão Financeira Pessoal',
    description: 'Registe despesas no Telegram em 3 segundos. O Finly elimina a confusão das contas.',
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
  return (
    <html lang="pt-PT" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${plusJakarta.variable} antialiased overflow-x-hidden`}
      >
        <ErrorBoundary>
          <InstallPromptProvider>
            <LanguageProvider>
              <UserProvider>
                {children}
                <CookieBanner />
              </UserProvider>
            </LanguageProvider>
          </InstallPromptProvider>
        </ErrorBoundary>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                function isChunkLoadError(msg) {
                  if (!msg || typeof msg !== 'string') return false;
                  var s = msg.toLowerCase();
                  return s.indexOf('chunkloaderror') !== -1 || s.indexOf('loading chunk') !== -1 && s.indexOf('failed') !== -1 || s.indexOf('failed to fetch dynamically imported module') !== -1;
                }
                function recoverChunkError() {
                  var url = window.location.href.split('?')[0] + '?_t=' + Date.now();
                  function go() { window.location.replace(url); }
                  var p = Promise.resolve();
                  if ('caches' in window) { p = p.then(function() { return caches.keys().then(function(ns) { ns.forEach(function(n) { caches.delete(n); }); }); }); }
                  if ('serviceWorker' in navigator) { p = p.then(function() { return navigator.serviceWorker.getRegistrations().then(function(regs) { regs.forEach(function(r) { r.unregister(); }); }); }); }
                  p.then(go).catch(go);
                }
                window.addEventListener('error', function(event) {
                  if (isChunkLoadError(event.message)) { event.preventDefault(); recoverChunkError(); return true; }
                }, true);
                window.addEventListener('unhandledrejection', function(event) {
                  var msg = event.reason && (event.reason.message || event.reason);
                  if (isChunkLoadError(typeof msg === 'string' ? msg : (msg && msg.message) || '')) { event.preventDefault(); recoverChunkError(); }
                });
              })();
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() { navigator.serviceWorker.register('/sw.js').catch(function() {}); });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
