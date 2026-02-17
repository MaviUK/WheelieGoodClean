import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data?.user) {
    redirect("/login");
  }

  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="mt-2 text-zinc-600">
        Welcome, {data.user.email}
      </p>
    </div>
  );
}
