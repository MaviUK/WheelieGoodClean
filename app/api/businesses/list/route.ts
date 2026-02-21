import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const businesses = await prisma.business.findMany({
    where: { ownerUserId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ businesses });
}
