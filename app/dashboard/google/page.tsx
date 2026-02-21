import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClientReadOnly } from "@/lib/supabase/server-readonly";
import SyncReviewsButton from "./SyncReviewsButton";


export default async function GooglePage() {
  const supabase = await createSupabaseServerClientReadOnly();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/login");

  const { data: account } = await supabase
    .from("google_accounts")
    .select("email, refresh_token, access_token, expiry_date, updated_at")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  const connected = !!(account?.refresh_token || account?.access_token);

  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold">Google</h1>
      <p className="mt-2 text-zinc-600">
        Connect Google Business Profile to sync locations + reviews.
      </p>

      <div className="mt-6 rounded-2xl border p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="font-semibold">
              Status:{" "}
              <span className={connected ? "text-green-600" : "text-zinc-500"}>
                {connected ? "Connected" : "Not connected"}
              </span>
            </div>
            {account?.updated_at && (
              <div className="mt-1 text-sm text-zinc-500">
                Last updated: {new Date(account.updated_at).toLocaleString()}
              </div>
            )}
          </div>

          {!connected ? (
            <Link
              href="/api/google/start"
              className="inline-flex rounded-xl bg-black px-4 py-2 text-white"
            >
              Connect Google
            </Link>
          ) : (
            <form action="/api/google/disconnect" method="post">
              <button className="inline-flex rounded-xl border px-4 py-2">
                Disconnect
              </button>
            </form>
          )}
        </div>
{connected && <SyncReviewsButton />}



      </div>
    </div>
  );
}
