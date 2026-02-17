import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function GooglePage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data?.user) redirect("/login");

  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold">Google</h1>
      <p className="mt-2 text-zinc-600">
        Connect Google Business Profile to sync locations + reviews.
      </p>

      <div className="mt-6">
        <Link
          href="/api/google/start"
          className="inline-flex rounded-xl bg-black px-4 py-2 text-white"
        >
          Connect Google
        </Link>
      </div>
    </div>
  );
}
