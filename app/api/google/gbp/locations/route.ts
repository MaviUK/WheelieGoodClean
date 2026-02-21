import { NextResponse } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler-client";
import { getValidGoogleTokensForBusiness, listLocations } from "@/lib/google/gbp";

export async function GET(req: Request) {
  const supabase = await createSupabaseRouteHandlerClient();
  const { data } = await supabase.auth.getUser();
  if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const businessId = url.searchParams.get("businessId");
  const accountName = url.searchParams.get("accountName");

  if (!businessId) return NextResponse.json({ error: "businessId required" }, { status: 400 });
  if (!accountName) return NextResponse.json({ error: "accountName required" }, { status: 400 });

  const tokens = await getValidGoogleTokensForBusiness({
    businessId,
    ownerUserId: data.user.id,
  });

  const locations = await listLocations(tokens.accessToken, accountName);
  return NextResponse.json({ locations });
}
