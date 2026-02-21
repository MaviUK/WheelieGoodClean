import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import BusinessActionsClient from "./BusinessActionsClient";

type PageProps = {
  params: Promise<{ businessId: string }>;
};

export default async function BusinessDetailsPage(props: PageProps) {
  const { businessId } = await props.params;

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data?.user) {
    redirect("/login");
  }

  const business = await prisma.business.findFirst({
    where: {
      id: businessId,
      ownerUserId: data.user.id,
    },
    select: {
      id: true,
      name: true,
      googleAccountName: true,
      googleLocationName: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!business) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{business.name}</h1>
          <p className="text-sm text-muted-foreground">
            Business ID: <span className="font-mono">{business.id}</span>
          </p>
        </div>

        <BusinessActionsClient
          businessId={business.id}
          isConnected={!!(business.googleAccountName && business.googleLocationName)}
        />
      </div>

      <div className="rounded-lg border p-4 space-y-2">
        <h2 className="font-medium">Google Connection</h2>

        <div className="text-sm">
          <div className="flex gap-2">
            <span className="w-44 text-muted-foreground">Account:</span>
            <span className="font-mono">
              {business.googleAccountName ?? "— not selected —"}
            </span>
          </div>
          <div className="flex gap-2">
            <span className="w-44 text-muted-foreground">Location:</span>
            <span className="font-mono">
              {business.googleLocationName ?? "— not selected —"}
            </span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground pt-2">
          Connect Google first, then choose an account + location. After that you can sync reviews.
        </p>
      </div>

      <div className="rounded-lg border p-4 space-y-2">
        <h2 className="font-medium">Next Steps</h2>
        <ol className="list-decimal pl-5 text-sm space-y-1">
          <li>Click <b>Connect Google</b> to authorize access.</li>
          <li>Pick the correct Google account + location (we’ll build this next).</li>
          <li>Click <b>Sync Reviews</b> to pull reviews into your DB.</li>
        </ol>
      </div>
    </div>
  );
}
