"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient, isSupabaseConfigured } from "@fil/supabase";

/** Re-renders the server page whenever a check-in lands (the one attendance write). */
export function LiveRefresh() {
  const router = useRouter();
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const db = createBrowserSupabaseClient();
    const channel = db.channel("checkins-live").on("postgres_changes", { event: "INSERT", schema: "public", table: "checkins" }, () => router.refresh()).subscribe();
    const timer = setInterval(() => router.refresh(), 30_000);
    return () => { db.removeChannel(channel); clearInterval(timer); };
  }, [router]);
  return null;
}
