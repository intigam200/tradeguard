import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "TradeGuard — Торговая дисциплина",
  description: "SaaS-платформа для контроля торговой дисциплины трейдеров",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={`${geistSans.variable} antialiased bg-[#0f1117] text-slate-200`}>
        {children}
      </body>
    </html>
  );
}
