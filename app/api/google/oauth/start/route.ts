import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import crypto from "crypto";
import { createSupabaseServerClientReadOnly } from "@/lib/supabase/server-readonly";
import { prisma } from "@/lib/prisma";

function signState(payloadJson: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(payloadJson).digest("hex");
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const businessId = url.searchParams.get("businessId");

  if (!businessId) {
    return NextResponse.json({ error: "businessId required" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClientReadOnly();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth?.user) {
    // If you prefer JSON: return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    redirect("/login");
  }

  // Make sure the business belongs to the logged-in user
  const business = await prisma.business.findFirst({
    where: { id: businessId, ownerUserId: auth.user.id },
    select: { id: true },
  });

  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI!;
  const scopes = (process.env.GOOGLE_OAUTH_SCOPES ||
    "https://www.googleapis.com/auth/business.manage openid email profile")!;
  const stateSecret = process.env.OAUTH_STATE_SECRET!;

  if (!clientId || !redirectUri || !stateSecret) {
    return NextResponse.json(
      { error: "Missing env", details: { clientId: !!clientId, redirectUri: !!redirectUri, stateSecret: !!stateSecret } },
      { status: 500 }
    );
  }

  const payload = {
    businessId,
    userId: auth.user.id,
    ts: Date.now(),
  };

  const payloadJson = JSON.stringify(payload);
  const sig = signState(payloadJson, stateSecret);

  // Put payload+sig into state. (base64url)
  const stateObj = { payloadJson, sig };
  const state = Buffer.from(JSON.stringify(stateObj)).toString("base64url");

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("include_granted_scopes", "true");
  authUrl.searchParams.set("scope", scopes);
  authUrl.searchParams.set("state", state);

  return NextResponse.redirect(authUrl.toString());
}