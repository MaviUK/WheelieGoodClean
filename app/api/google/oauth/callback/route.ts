import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler-client";
import { encryptString } from "@/lib/crypto/encryption";

function verifyAndReadState(state: string): { businessId: string; userId: string; ts: number } {
  const secret = process.env.OAUTH_STATE_SECRET;
  if (!secret) throw new Error("Missing env: OAUTH_STATE_SECRET");

  const decoded = JSON.parse(Buffer.from(state, "base64url").toString("utf8")) as {
    payloadJson: string;
    sig: string;
  };

  const expected = crypto.createHmac("sha256", secret).update(decoded.payloadJson).digest("hex");
  if (expected !== decoded.sig) throw new Error("Invalid OAuth state signature");

  const payload = JSON.parse(decoded.payloadJson) as { businessId: string; userId: string; ts: number };
  if (!payload.businessId || !payload.userId) throw new Error("Invalid OAuth state payload");

  // Optional: expire state after 10 minutes
  if (Date.now() - payload.ts > 10 * 60 * 1000) throw new Error("OAuth state expired");

  return payload;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");

  if (err) {
    return NextResponse.redirect(new URL(`/dashboard/businesses?google_error=${encodeURIComponent(err)}`, req.url));
  }

  if (!code || !state) {
    return NextResponse.json({ error: "Missing code/state" }, { status: 400 });
  }

  // Must be logged in (ties OAuth result to current session)
  const supabase = await createSupabaseRouteHandlerClient();
  const { data } = await supabase.auth.getUser();
  if (!data?.user) return NextResponse.redirect(new URL("/login", req.url));

  // Validate state (and get businessId)
  let stateData: { businessId: string; userId: string; ts: number };
  try {
    stateData = verifyAndReadState(state);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Invalid state" }, { status: 400 });
  }

  // Ensure the same user who started the flow is completing it
  if (stateData.userId !== data.user.id) {
    return NextResponse.json({ error: "User mismatch" }, { status: 403 });
  }

  // Ensure business ownership
  const business = await prisma.business.findFirst({
    where: { id: stateData.businessId, ownerUserId: data.user.id },
    select: { id: true },
  });
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      grant_type: "authorization_code",
    }),
  });

  const tokenJson = await tokenRes.json().catch(() => ({} as any));
  if (!tokenRes.ok) {
    return NextResponse.json(
      { error: "Token exchange failed", details: tokenJson },
      { status: 400 }
    );
  }

  const accessToken = tokenJson.access_token as string | undefined;
  const refreshToken = tokenJson.refresh_token as string | undefined;
  const expiresIn = Number(tokenJson.expires_in ?? 0);
  const scope = tokenJson.scope as string | undefined;

  if (!accessToken) {
    return NextResponse.json({ error: "Missing access_token from Google" }, { status: 400 });
  }
  if (!refreshToken) {
    // If user already granted before and Google didn't return refresh_token,
    // you can keep the existing one if present. We'll enforce it for now.
    return NextResponse.json(
      { error: "Missing refresh_token. Try again with prompt=consent (already set)." },
      { status: 400 }
    );
  }

  const expiryDate = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;

  // Store encrypted tokens in GoogleOAuthConnection (businessId is unique)
  await prisma.googleOAuthConnection.upsert({
    where: { businessId: stateData.businessId },
    create: {
      businessId: stateData.businessId,
      encryptedAccessToken: encryptString(accessToken),
      encryptedRefreshToken: encryptString(refreshToken),
      expiryDate,
      scopes: scope ?? null,
    },
    update: {
      encryptedAccessToken: encryptString(accessToken),
      encryptedRefreshToken: encryptString(refreshToken),
      expiryDate,
      scopes: scope ?? null,
    },
  });

  // ✅ Redirect back to the *business* page (no generic /dashboard/google anymore)
  return NextResponse.redirect(
    new URL(`/dashboard/businesses/${stateData.businessId}?connected=1`, req.url)
  );
}
