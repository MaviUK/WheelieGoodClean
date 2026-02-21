import { OAuth2Client } from "google-auth-library";


export async function getGoogleClient(workspaceId: string) {
  const conn = await prisma.googleConnection.findUnique({ where: { workspaceId } });
  if (!conn) throw new Error("Google not connected");

  const client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI!
  );

  client.setCredentials({
    access_token: conn.accessToken,
    refresh_token: conn.refreshToken,
    expiry_date: conn.expiryDate.getTime(),
  });

  // Auto-refresh if needed (google-auth-library will refresh on request when expired)
  return client;
}
