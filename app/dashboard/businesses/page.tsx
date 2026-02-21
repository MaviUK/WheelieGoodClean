import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import CreateBusinessFormClient from "./CreateBusinessFormClient";

export default async function BusinessesPage() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    redirect("/login");
  }

  const businesses = await prisma.business.findMany({
    where: { ownerUserId: data.user.id },
    orderBy: { name: "asc" }, // ✅ no createdAt dependency
    select: {
      id: true,
      name: true,
      googleAccountName: true,
      googleLocationName: true,
    },
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Businesses</h1>
          <p className="text-sm text-muted-foreground">
            Create a business, connect Google, then sync reviews.
          </p>
        </div>

        <CreateBusinessFormClient />
      </div>

      <div className="space-y-2">
        {businesses.length === 0 ? (
          <div className="rounded-lg border p-4 text-sm text-muted-foreground">
            No businesses yet.
          </div>
        ) : (
          <div className="rounded-lg border divide-y">
            {businesses.map((b) => {
              const connected = !!(b.googleAccountName && b.googleLocationName);
              return (
                <Link
                  key={b.id}
                  href={`/dashboard/businesses/${b.id}`}
                  className="block p-4 hover:bg-muted/50"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{b.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {b.id}
                      </div>
                    </div>

                    <div
                      className={`text-xs rounded-full px-2 py-1 border ${
                        connected ? "bg-green-50" : "bg-yellow-50"
                      }`}
                    >
                      {connected ? "Connected" : "Not connected"}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
