import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "FALLing in Love · Operations", robots: { index: false, follow: false } };
export const viewport: Viewport = { themeColor: "#1F1A16", viewportFit: "cover" };

export default function OpsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
