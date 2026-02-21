import { NextResponse } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler-client";
import { getValidGoogleTokensForBusiness, listAccounts } from "@/lib/google/gbp";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const supabase = await createSupabaseRouteHandlerClient();
    const { data, error: userErr } = await supabase.auth.getUser();

    if (userErr) {
      return NextResponse.json(
        { error: "Auth error", details: userErr },
        { status: 401 }
      );
    }

    if (!data?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const businessId = url.searchParams.get("businessId");

    if (!businessId) {
      return NextResponse.json(
        { error: "businessId required" },
        { status: 400 }
      );
    }

    // This is the step that often throws if tokens are missing/expired/refresh fails
    let tokens;
    try {
      tokens = await getValidGoogleTokensForBusiness({
        businessId,
        ownerUserId: data.user.id,
      });
    } catch (e: any) {
      return NextResponse.json(
        {
          error: "Failed to get valid Google tokens for this business",
          details: e?.message ?? String(e),
        },
        { status: 401 }
      );
    }

    if (!tokens?.accessToken) {
      return NextResponse.json(
        { error: "No access token available (not connected?)" },
        { status: 401 }
      );
    }

    // This can also throw if Google API rejects the token / wrong scopes / wrong endpoint
    let accounts;
    try {
      accounts = await listAccounts(tokens.accessToken);
    } catch (e: any) {
      return NextResponse.json(
        {
          error: "Google API failed while listing accounts",
          details: e?.message ?? String(e),
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ accounts });
  } catch (e: any) {
    // Catch-all so you ALWAYS get a JSON response instead of a blank 500
    return NextResponse.json(
      {
        error: "Unhandled error in /api/google/gbp/accounts",
        details: e?.message ?? String(e),
      },
      { status: 500 }
    );
  }
}