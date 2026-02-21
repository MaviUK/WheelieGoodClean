import { prisma } from "@/lib/prisma";
import { decryptString, encryptString } from "@/lib/crypto/encryption";

type GoogleTokens = {
  accessToken: string;
  refreshToken: string;
  expiryDate: Date | null;
};

async function refreshAccessToken(refreshToken: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Google token refresh failed: ${json?.error ?? res.status}`);
  }

  const accessToken = json.access_token as string;
  const expiresIn = Number(json.expires_in ?? 0);
  const expiryDate = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;

  return { accessToken, expiryDate };
}

export async function getValidGoogleTokensForBusiness(params: {
  businessId: string;
  ownerUserId: string;
}): Promise<GoogleTokens> {
  const business = await prisma.business.findFirst({
    where: { id: params.businessId, ownerUserId: params.ownerUserId },
    select: { id: true },
  });
  if (!business) throw new Error("Business not found");

  const conn = await prisma.googleOAuthConnection.findUnique({
    where: { businessId: params.businessId },
  });
  if (!conn) throw new Error("Google not connected for this business");

  const accessToken = decryptString(conn.encryptedAccessToken);
  const refreshToken = decryptString(conn.encryptedRefreshToken);

  const needsRefresh =
    !conn.expiryDate || conn.expiryDate.getTime() <= Date.now() + 60_000;

  if (!needsRefresh) {
    return { accessToken, refreshToken, expiryDate: conn.expiryDate };
  }

  const refreshed = await refreshAccessToken(refreshToken);

  await prisma.googleOAuthConnection.update({
    where: { businessId: params.businessId },
    data: {
      encryptedAccessToken: encryptString(refreshed.accessToken),
      expiryDate: refreshed.expiryDate,
    },
  });

  return {
    accessToken: refreshed.accessToken,
    refreshToken,
    expiryDate: refreshed.expiryDate,
  };
}

async function googleFetch(accessToken: string, url: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Google API failed ${res.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

/**
 * Accounts (Account Management API)
 * https://mybusinessaccountmanagement.googleapis.com/v1/accounts
 */
export async function listAccounts(accessToken: string) {
  const json = await googleFetch(
    accessToken,
    "https://mybusinessaccountmanagement.googleapis.com/v1/accounts"
  );
  const accounts = (json.accounts ?? []) as Array<{ name: string; accountName?: string }>;
  return accounts.map((a) => ({
    name: a.name, // e.g. "accounts/1234567890"
    displayName: (a as any).accountName ?? (a as any).name,
  }));
}

/**
 * Locations (Business Information API)
 * https://mybusinessbusinessinformation.googleapis.com/v1/{account}/locations?readMask=...
 */
export async function listLocations(accessToken: string, accountName: string) {
  const url = new URL(
    `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations`
  );
  url.searchParams.set(
    "readMask",
    "name,title,storefrontAddress,websiteUri"
  );

  const json = await googleFetch(accessToken, url.toString());
  const locations = (json.locations ?? []) as Array<any>;

  return locations.map((l) => ({
    name: l.name, // e.g. "accounts/123/locations/456"
    title: l.title ?? l.name,
    address: l.storefrontAddress
      ? [
          l.storefrontAddress.addressLines?.join(", "),
          l.storefrontAddress.locality,
          l.storefrontAddress.postalCode,
        ]
          .filter(Boolean)
          .join(", ")
      : null,
  }));
}
