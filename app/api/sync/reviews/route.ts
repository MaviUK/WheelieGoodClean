import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getGoogleClient } from "@/lib/google/client";
import { listAccounts, listLocations, listReviewsV4 } from "@/lib/google/api";

export async function POST() {
  const supabase = createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspace = await prisma.workspace.findFirst({
    where: { members: { some: { userId: auth.user.id } } },
  });
  if (!workspace) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const client = await getGoogleClient(workspace.id);

  // 1) Pick first account (v1). Later: let user select which account.
  const accounts = await listAccounts(client);
  const accountName = accounts.accounts?.[0]?.name; // "accounts/123"
  if (!accountName) return NextResponse.json({ error: "No Google accounts found" }, { status: 400 });
  const accountId = accountName.split("/")[1];

  // 2) Pull locations
  const locRes = await listLocations(client, accountName);
  const locations = locRes.locations || [];

  for (const loc of locations) {
    const googleLocationName: string = loc.name; // "locations/XYZ" or full resource name
    const googleLocationId = googleLocationName.split("/").pop()!;
    const title = loc.title || "Untitled";

    const dbLoc = await prisma.googleLocation.upsert({
      where: { googleAccountId_googleLocationId: { googleAccountId: accountId, googleLocationId } },
      update: { name: title },
      create: {
        workspaceId: workspace.id,
        googleAccountId: accountId,
        googleLocationId,
        name: title,
      },
    });

    // 3) Pull reviews (v4 list)
    const revRes = await listReviewsV4(client, accountId, googleLocationId);
    const reviews = revRes.reviews || [];

    for (const r of reviews) {
      const googleReviewId = r.reviewId || r.name; // varies by payload
      if (!googleReviewId) continue;

      await prisma.review.upsert({
        where: { googleReviewId },
        update: {
          rating: r.starRating ? Number(r.starRating) : 0,
          text: r.comment || "",
          authorName: r.reviewer?.displayName || "Anonymous",
          authorPhotoUrl: r.reviewer?.profilePhotoUrl || null,
          createTime: r.createTime ? new Date(r.createTime) : new Date(),
          updateTime: r.updateTime ? new Date(r.updateTime) : null,
        },
        create: {
          googleReviewId,
          locationId: dbLoc.id,
          rating: r.starRating ? Number(r.starRating) : 0,
          text: r.comment || "",
          authorName: r.reviewer?.displayName || "Anonymous",
          authorPhotoUrl: r.reviewer?.profilePhotoUrl || null,
          createTime: r.createTime ? new Date(r.createTime) : new Date(),
          updateTime: r.updateTime ? new Date(r.updateTime) : null,
        },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
