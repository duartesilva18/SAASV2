import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/LanguageContext";
import { UserProvider } from "@/lib/UserContext";
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
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://finly.pt'),
  alternates: {
    canonical: '/',
    languages: {
      'pt-PT': '/pt',
      'en': '/en',
    },
  },
  openGraph: {
    type: 'website',
    locale: 'pt_PT',
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
  themeColor: "#3b82f6",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-PT" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#3b82f6" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ErrorBoundary>
          <LanguageProvider>
            <UserProvider>
              {children}
              <CookieBanner />
            </UserProvider>
          </LanguageProvider>
        </ErrorBoundary>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js')
                    .then((reg) => console.log('Service Worker registado:', reg))
                    .catch((err) => console.log('Erro ao registar Service Worker:', err));
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
