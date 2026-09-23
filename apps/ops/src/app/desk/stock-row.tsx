"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adjustStock } from "./actions";

export function StockRow({ id, name, qty }: { id: string; name: string; qty: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const bump = async (d: number) => { setBusy(true); try { await adjustStock(id, d); router.refresh(); } finally { setBusy(false); } };
  return (
    <div className="srow">
      <span className="nm">{name}</span>
      <span className={`qty ${qty < 25 ? "low" : ""}`}>{qty}</span>
      <button onClick={() => bump(-1)} disabled={busy} aria-label="하나 빼기">−</button>
      <button onClick={() => bump(1)} disabled={busy} aria-label="하나 더하기">+</button>
    </div>
  );
}
