import { NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/dashboard/google?error=missing_code", url.origin));
  }

  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;

  if (!user) {
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  const client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI!
  );

  const { tokens } = await client.getToken(code);

  // Save tokens against this Supabase user
  await supabase.from("google_accounts").upsert({
    user_id: user.id,
    access_token: tokens.access_token ?? null,
    refresh_token: tokens.refresh_token ?? null,
    scope: tokens.scope ?? null,
    token_type: tokens.token_type ?? null,
    expiry_date: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
  });

  return NextResponse.redirect(new URL("/dashboard/google?connected=1", url.origin));
}
