import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: { widgetId: string } }) {
  const widget = await prisma.widget.findUnique({
    where: { id: params.widgetId },
    include: {
      location: {
        include: {
          reviews: true,
        },
      },
    },
  });

  if (!widget) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const filters = (widget.filters as any) || {};
  const minRating = Number(filters.minRating ?? 1);
  const maxItems = Number(filters.maxItems ?? 10);
  const sort = String(filters.sort ?? "newest"); // newest | highest

  let reviews = widget.location.reviews
    .filter((r) => !r.hidden && r.rating >= minRating)
    .map((r) => ({
      id: r.googleReviewId,
      author: r.authorName,
      photo: r.authorPhotoUrl,
      rating: r.rating,
      text: r.text,
      date: r.createTime.toISOString().slice(0, 10),
    }));

  if (sort === "highest") reviews.sort((a, b) => b.rating - a.rating);
  else reviews.sort((a, b) => (a.date < b.date ? 1 : -1));

  reviews = reviews.slice(0, maxItems);

  const payload = {
    business: {
      name: widget.location.name,
      averageRating: widget.location.averageRating,
      reviewCount: widget.location.reviewCount,
    },
    widget: {
      layout: widget.layout,
      theme: widget.theme,
      filters: widget.filters,
    },
    reviews,
  };

  return NextResponse.json(payload, {
    headers: {
      // Cache at CDN/browser; you can tighten per plan later
      "Cache-Control": "public, max-age=600, stale-while-revalidate=86400",
    },
  });
}
