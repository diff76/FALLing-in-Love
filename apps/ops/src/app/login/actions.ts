"use server";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase-server";
import { toEmail } from "@/lib/login-id";

export async function signIn(formData: FormData) {
  const db = await supabaseServer();
  if (!db) redirect("/login?reason=unconfigured");
  const email = toEmail(String(formData.get("login") ?? formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) redirect(`/login?error=1&next=${encodeURIComponent(next)}`);
  redirect(next.startsWith("/") ? next : "/");
}

export async function signOut() {
  const db = await supabaseServer();
  if (db) await db.auth.signOut();
  redirect("/login");
}
