import { NextResponse } from "next/server";
import crypto from "crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

function signState(payloadJson: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(payloadJson).digest("hex");
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.json({ error: "Missing code/state" }, { status: 400 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  const stateSecret = process.env.OAUTH_STATE_SECRET;
  const appUrl = process.env.APP_URL || "http://localhost:3000";

  if (!clientId || !clientSecret || !redirectUri || !stateSecret) {
    return NextResponse.json(
      {
        error: "Missing env vars",
        details: {
          GOOGLE_CLIENT_ID: !!clientId,
          GOOGLE_CLIENT_SECRET: !!clientSecret,
          GOOGLE_REDIRECT_URI: !!redirectUri,
          OAUTH_STATE_SECRET: !!stateSecret,
        },
      },
      { status: 500 }
    );
  }

  // Decode and verify state
  let decoded: { payloadJson: string; sig: string };
  try {
    decoded = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
  } catch {
    return NextResponse.json({ error: "Invalid state" }, { status: 400 });
  }

  const expectedSig = signState(decoded.payloadJson, stateSecret);
  if (decoded.sig !== expectedSig) {
    return NextResponse.json(
      { error: "State signature mismatch" },
      { status: 400 }
    );
  }

  const payload = JSON.parse(decoded.payloadJson) as {
    businessId: string;
    userId: string;
    ts: number;
  };

  // reject old states (10 min)
  if (Date.now() - payload.ts > 10 * 60 * 1000) {
    return NextResponse.json({ error: "State expired" }, { status: 400 });
  }

  // Auth user must match state userId
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth?.user || auth.user.id !== payload.userId) {
    return NextResponse.json(
      { error: "Unauthorized user for this state" },
      { status: 401 }
    );
  }

  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const tokenJson = await tokenRes.json();
  if (!tokenRes.ok) {
    return NextResponse.json(
      { error: "Token exchange failed", details: tokenJson },
      { status: 400 }
    );
  }

  const access_token = tokenJson.access_token as string | undefined;
  const refresh_token = tokenJson.refresh_token as string | undefined;
  const expires_in = tokenJson.expires_in as number | undefined;

  const expiry_date =
    typeof expires_in === "number"
      ? new Date(Date.now() + expires_in * 1000)
      : null;

  // IMPORTANT:
  // Google often only returns refresh_token the *first* time.
  // If it's missing, keep the existing refresh_token.
  const { data: existing } = await supabaseAdmin
    .from("google_accounts")
    .select("refresh_token")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  const finalRefreshToken = refresh_token ?? existing?.refresh_token ?? null;

  // Upsert with explicit conflict target
  const { error: upsertError } = await supabaseAdmin
    .from("google_accounts")
    .upsert(
      {
        user_id: auth.user.id,
        access_token: access_token ?? null,
        refresh_token: finalRefreshToken,
        expiry_date: expiry_date?.toISOString() ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (upsertError) {
    return NextResponse.json(
      { error: "Failed to save tokens", details: upsertError },
      { status: 500 }
    );
  }

  return NextResponse.redirect(
    new URL(`/dashboard/businesses/${payload.businessId}?connected=1`, appUrl)
  );
}