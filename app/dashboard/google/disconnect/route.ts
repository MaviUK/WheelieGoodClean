import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const url = new URL(req.url);

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.redirect(new URL("/login", url.origin));

  await supabase
    .from("google_accounts")
    .update({
      access_token: null,
      refresh_token: null,
      scope: null,
      token_type: null,
      expiry_date: null,
    })
    .eq("user_id", auth.user.id);

  return NextResponse.redirect(new URL("/dashboard/google", url.origin));
}
