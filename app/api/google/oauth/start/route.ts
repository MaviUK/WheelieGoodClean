import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler-client";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

function signState(payload: object) {
  const secret = process.env.OAUTH_STATE_SECRET;
  if (!secret) throw new Error("Missing env: OAUTH_STATE_SECRET");

  const payloadJson = JSON.stringify(payload);
  const sig = crypto.createHmac("sha256", secret).update(payloadJson).digest("hex");
  return Buffer.from(JSON.stringify({ payloadJson, sig })).toString("base64url");
}

export async function GET(req: Request) {
  const supabase = await createSupabaseRouteHandlerClient();
  const { data } = await supabase.auth.getUser();

  if (!data?.user) return NextResponse.redirect(new URL("/login", req.url));

  const url = new URL(req.url);
  const businessId = url.searchParams.get("businessId");
  if (!businessId) return NextResponse.json({ error: "businessId required" }, { status: 400 });

  const business = await prisma.business.findFirst({
    where: { id: businessId, ownerUserId: data.user.id },
    select: { id: true },
  });

  if (!business) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const state = signState({
    businessId,
    userId: data.user.id,
    ts: Date.now(),
  });

  const authUrl = new URL(GOOGLE_AUTH_URL);
  authUrl.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID!);
  authUrl.searchParams.set("redirect_uri", process.env.GOOGLE_REDIRECT_URI!);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set(
    "scope",
    [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/business.manage",
    ].join(" ")
  );
  authUrl.searchParams.set("state", state);

  return NextResponse.redirect(authUrl.toString());
}
