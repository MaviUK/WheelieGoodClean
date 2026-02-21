import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClientReadOnly } from "@/lib/supabase/server-readonly";
import GoogleBusinessChooserClient from "./GoogleBusinessChooserClient";

export default async function GooglePage() {
  const supabase = await createSupabaseServerClientReadOnly();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/login");

  const businesses = await prisma.business.findMany({
    where: { ownerUserId: auth.user.id },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      googleAccountName: true,
      googleLocationName: true,
      // ✅ your actual relation field name
      googleConnection: {
        select: {
          id: true,
          updatedAt: true,
          expiryDate: true,
        },
      },
    },
  });

  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold">Google</h1>
      <p className="mt-2 text-zinc-600">
        Connect Google Business Profile per business, then sync reviews.
      </p>

      <div className="mt-6 rounded-2xl border p-5">
        <GoogleBusinessChooserClient businesses={businesses} />
      </div>
    </div>
  );
}