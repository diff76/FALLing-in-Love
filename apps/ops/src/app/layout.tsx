import type { Metadata, Viewport } from "next";
import { Syne } from "next/font/google";
import "./globals.css";

const syne = Syne({ subsets: ["latin"], weight: ["400", "600", "800"], variable: "--font-syne", display: "swap" });

export const metadata: Metadata = { title: "FALLing in Love · Operations", robots: { index: false, follow: false } };
export const viewport: Viewport = { themeColor: "#1F1A16", viewportFit: "cover" };

export default function OpsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko" className={syne.variable}><body>{children}</body></html>;
}
