"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

/** Tab strip. The current tab is marked from the live pathname (exact for /admin, prefix elsewhere). */
export function OpsNav({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname() ?? "";
  const k = useSearchParams()?.get("k");   // access-link key: carried along so a home-screen icon of any tab signs itself in
  const withKey = (href: string) => (k ? `${href}?k=${encodeURIComponent(k)}` : href);
  const isActive = (href: string) => (href === "/admin" ? path === "/admin" : path === href || path.startsWith(href + "/"));
  return (
    <nav aria-label="운영 화면">
      {items.map((n) => <Link href={withKey(n.href)} key={n.href} className={isActive(n.href) ? "active" : undefined} aria-current={isActive(n.href) ? "page" : undefined}>{n.label}</Link>)}
    </nav>
  );
}
