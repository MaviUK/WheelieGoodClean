import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import SyncReviewsButton from "./google/SyncReviewsButton";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const businesses = await prisma.business.findMany({
    where: { ownerUserId: user.id },
    orderBy: { createdAt: "desc" },
  });

  const activeBusiness = businesses[0]; // simplest v1: “most recent business”

  return (
    <div>
      <h1 className="text-xl font-bold">Dashboard</h1>

      {/* Create Business */}
      <form
        className="mt-4 flex gap-2"
        action={async (formData) => {
          "use server";
          const name = String(formData.get("name") ?? "");
          // You’d normally call prisma directly in a server action,
          // but keeping API route is fine too.
        }}
      >
        {/* if you want, we’ll do this as a client form instead */}
      </form>

      {/* If they have a business, show sync */}
      {activeBusiness ? (
        <div className="mt-6">
          <div className="text-sm opacity-80">
            Active business: <b>{activeBusiness.name}</b>
          </div>
          <SyncReviewsButton businessId={activeBusiness.id} />
        </div>
      ) : (
        <p className="mt-6">Create your first business to get started.</p>
      )}
    </div>
  );
}
