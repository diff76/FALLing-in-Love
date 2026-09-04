import type { Metadata, Viewport } from "next";
import { Fraunces, Gowun_Batang, Syne } from "next/font/google";
import { eventConfig } from "@fil/config";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], style: ["normal", "italic"], axes: ["opsz", "SOFT"], variable: "--font-fraunces", display: "swap" });
const syne = Syne({ subsets: ["latin"], weight: ["400", "600", "800"], variable: "--font-syne", display: "swap" });
const gowun = Gowun_Batang({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-gowun", display: "swap" });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: `${eventConfig.name} | ${eventConfig.edition}`, template: `%s | ${eventConfig.name}` },
  description: `음악과 정원, 커피와 대화가 있는 가을 오후. ${eventConfig.dateLabel} ${eventConfig.venue.short}.`,
  openGraph: {
    title: `${eventConfig.name} — ${eventConfig.tagline}`,
    description: `${eventConfig.dateLabel} 낮 ${eventConfig.opensAt}–오후 ${eventConfig.closesAt} · ${eventConfig.venue.short} Chapel & Garden`,
    type: "website",
    images: [{ url: "/media/og.jpg", width: 1600, height: 840, alt: "FALLing in Love 캠퍼스 디오라마" }],
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#F7F1E4", viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className={`${fraunces.variable} ${gowun.variable} ${syne.variable}`} data-scroll-behavior="smooth">
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
