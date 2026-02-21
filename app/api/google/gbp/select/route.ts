import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler-client";

export async function POST(req: Request) {
  const supabase = await createSupabaseRouteHandlerClient();
  const { data } = await supabase.auth.getUser();
  if (!data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as any;
  const businessId = typeof body?.businessId === "string" ? body.businessId : null;
  const googleAccountName = typeof body?.googleAccountName === "string" ? body.googleAccountName : null;
  const googleLocationName = typeof body?.googleLocationName === "string" ? body.googleLocationName : null;

  if (!businessId || !googleAccountName || !googleLocationName) {
    return NextResponse.json(
      { error: "businessId, googleAccountName, googleLocationName required" },
      { status: 400 }
    );
  }

  const business = await prisma.business.findFirst({
    where: { id: businessId, ownerUserId: data.user.id },
    select: { id: true },
  });
  if (!business) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.business.update({
    where: { id: businessId },
    data: { googleAccountName, googleLocationName },
  });

  return NextResponse.json({ ok: true });
}
