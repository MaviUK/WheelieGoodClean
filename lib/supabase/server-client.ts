import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Server Component safe Supabase client.
 * - Reads cookies
 * - No-op cookie setters (Server Components can't set cookies)
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // no-op in Server Components
        },
      },
    }
  );
}
