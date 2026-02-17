import { NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state"); // workspaceId
  if (!code || !state) return NextResponse.json({ error: "Missing code/state" }, { status: 400 });

  const client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI!
  );

  const { tokens } = await client.getToken(code);
  if (!tokens.access_token || !tokens.refresh_token || !tokens.expiry_date) {
    // If refresh_token is missing, Google didn't issue one (often due to missing prompt=consent / already granted)
    return NextResponse.json({ error: "Missing required tokens" }, { status: 400 });
  }

  await prisma.googleConnection.upsert({
    where: { workspaceId: state },
    update: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate: new Date(tokens.expiry_date),
    },
    create: {
      workspaceId: state,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate: new Date(tokens.expiry_date),
    },
  });

  return NextResponse.redirect(`${process.env.APP_URL}/dashboard?google=connected`);
}
