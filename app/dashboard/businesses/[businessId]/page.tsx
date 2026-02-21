import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import BusinessActionsClient from "./BusinessActionsClient";
import GooglePickerClient from "./GooglePickerClient";


export default async function BusinessDetailsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data?.user) redirect("/login");

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
    },
  });

  if (!business) notFound();

  const isConnected = !!(
    business.googleAccountName && business.googleLocationName
  );

  return (
  <div className="space-y-6 p-6">
    <div className="flex items-start justify-between gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{business.name}</h1>
        <div className="text-xs text-muted-foreground font-mono">
          {business.id}
        </div>
      </div>

      <BusinessActionsClient
        businessId={business.id}
        isConnected={isConnected}
      />
    </div>

    {/* Google Info */}
    <div className="rounded-lg border p-4 space-y-2">
      <div className="font-medium">Google</div>
      <div className="text-sm">
        <div>
          <span className="text-muted-foreground">Account: </span>
          <span className="font-mono">
            {business.googleAccountName ?? "—"}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Location: </span>
          <span className="font-mono">
            {business.googleLocationName ?? "—"}
          </span>
        </div>
      </div>
    </div>

    {/* 👇 ADD IT HERE */}
    {!isConnected ? (
      <GooglePickerClient businessId={business.id} />
    ) : null}

    <div className="rounded-lg border p-4 text-sm text-muted-foreground">
      Next: click <b>Connect Google</b>, authorize, then we’ll let you pick the
      right account/location.
    </div>
  </div>
);

