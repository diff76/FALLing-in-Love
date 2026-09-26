"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Tab strip. The current tab is marked from the live pathname (exact for /admin, prefix elsewhere). */
export function OpsNav({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname() ?? "";
  const isActive = (href: string) => (href === "/admin" ? path === "/admin" : path === href || path.startsWith(href + "/"));
  return (
    <nav aria-label="운영 화면">
      {items.map((n) => <Link href={n.href} key={n.href} className={isActive(n.href) ? "active" : undefined} aria-current={isActive(n.href) ? "page" : undefined}>{n.label}</Link>)}
    </nav>
  );
}
