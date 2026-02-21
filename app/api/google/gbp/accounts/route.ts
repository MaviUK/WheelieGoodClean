import { NextResponse } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler-client";
import { getValidGoogleTokensForBusiness, listAccounts } from "@/lib/google/gbp";

export async function GET(req: Request) {
  const supabase = await createSupabaseRouteHandlerClient();
  const { data } = await supabase.auth.getUser();
  if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const businessId = url.searchParams.get("businessId");
  if (!businessId) return NextResponse.json({ error: "businessId required" }, { status: 400 });

  const tokens = await getValidGoogleTokensForBusiness({
    businessId,
    ownerUserId: data.user.id,
  });

  const accounts = await listAccounts(tokens.accessToken);
  return NextResponse.json({ accounts });
}
