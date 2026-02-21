import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler-client";

export async function POST(req: Request) {
  const supabase = await createSupabaseRouteHandlerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const businessId =
    typeof body?.businessId === "string" ? body.businessId.trim() : "";

  if (!businessId) {
    return NextResponse.json({ error: "businessId required" }, { status: 400 });
  }

  // Ownership check
  const business = await prisma.business.findFirst({
    where: { id: businessId, ownerUserId: data.user.id },
    select: { id: true },
  });

  if (!business) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Disconnect
  await prisma.$transaction([
    prisma.googleOAuthConnection.deleteMany({ where: { businessId } }),
    prisma.business.update({
      where: { id: businessId },
      data: {
        googleAccountName: null,
        googleLocationName: null,
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
