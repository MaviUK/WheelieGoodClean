import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (code) {
    const supabase = await createSupabaseServerClient();
    // exchanges the code for a session + sets cookies
    await supabase.auth.exchangeCodeForSession(code);
  }

  // send user to dashboard after successful exchange
  return NextResponse.redirect(new URL("/dashboard", url.origin));
}
