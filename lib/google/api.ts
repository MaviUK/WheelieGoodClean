import { OAuth2Client } from "google-auth-library";

async function authedFetch(client: OAuth2Client, url: string) {
  const token = await client.getAccessToken();
  const accessToken = token?.token;
  if (!accessToken) throw new Error("No access token");

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google API error ${res.status}: ${text}`);
  }
  return res.json();
}

// List accounts (required to locate accountId)
export async function listAccounts(client: OAuth2Client) {
  return authedFetch(client, "https://mybusinessaccountmanagement.googleapis.com/v1/accounts");
}

// List locations under an account
export async function listLocations(client: OAuth2Client, accountName: string) {
  // accountName like "accounts/123"
  return authedFetch(
    client,
    `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title`
  );
}

// List reviews for a location (v4 reviews endpoint)
export async function listReviewsV4(client: OAuth2Client, accountId: string, locationId: string) {
  // v4 uses accounts/{accountId}/locations/{locationId}/reviews
  return authedFetch(
    client,
    `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/reviews?pageSize=200`
  );
}
