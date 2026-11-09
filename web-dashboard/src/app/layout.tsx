import type { Metadata } from "next";
import "./globals.css";
import { QueryProvider } from "@/components/providers/QueryProvider";

export const metadata: Metadata = {
  title: "Albayrak Finans PDKS · Personel Devam Kontrol Sistemi",
  description:
    "Albayrak Finans PDKS — Next.js, TypeScript, PostgreSQL 18, Prisma ORM ve Gerçek Zamanlı SSE tabanlı Kurumsal Personel Devam Kontrol Sistemi.",
  robots: { index: false, follow: false },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      {
        url: "/assets/branding/albayrak_pdks_logo.png",
        type: "image/png",
        sizes: "352x297"
      }
    ],
    shortcut: "/icon.svg",
    apple: "/assets/branding/albayrak_pdks_logo.png"
  }
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" data-theme="light" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="/legacy/styles.css" />
        <link rel="stylesheet" href="/legacy/landing.css" />
      </head>
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
