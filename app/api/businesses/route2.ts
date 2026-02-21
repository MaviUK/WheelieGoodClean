import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler-client";

export async function GET() {
  const supabase = await createSupabaseRouteHandlerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const businesses = await prisma.business.findMany({
    where: { ownerUserId: data.user.id },
    orderBy: { name: "asc" },
    select: {
      id: true,
      ownerUserId: true,
      name: true,
      googleAccountName: true,
      googleLocationName: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ businesses });
}

export async function POST(req: Request) {
  const supabase = await createSupabaseRouteHandlerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name =
    typeof (body as any)?.name === "string" ? (body as any).name.trim() : "";

  if (!name) {
    return NextResponse.json({ error: "Business name is required" }, { status: 400 });
  }

  const business = await prisma.business.create({
    data: {
      ownerUserId: data.user.id,
      name,
    },
    select: {
      id: true,
      ownerUserId: true,
      name: true,
      googleAccountName: true,
      googleLocationName: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ business }, { status: 201 });
}
