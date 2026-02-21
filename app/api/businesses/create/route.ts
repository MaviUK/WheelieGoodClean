import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();

  if (!name) {
    return NextResponse.json({ error: "Missing name" }, { status: 400 });
  }

  const business = await prisma.business.create({
    data: {
      ownerUserId: user.id,
      name,
    },
  });

  return NextResponse.json({ business });
}
