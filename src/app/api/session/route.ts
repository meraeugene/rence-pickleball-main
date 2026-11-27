import { NextResponse } from "next/server";
import { getAdminEmails, hasSupabaseConfig } from "@/utils/env/appEnv";
import { createClient } from "@/utils/supabase/server";

// Tells the browser whether the signed-in user is an admin (for showing the
// admin menu). Verified with Supabase on the server; never cached.
export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  if (!hasSupabaseConfig()) return NextResponse.json({ isAdmin: false }, { headers });

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email?.toLowerCase();
  const isAdmin = Boolean(email && getAdminEmails().includes(email));

  return NextResponse.json({ isAdmin }, { headers });
}
