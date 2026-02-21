// src/server/auth/getServerUser.ts
import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function getServerUser() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  // IMPORTANT:
  // For now, we will use Supabase user id as the ownerUserId in your Business table.
  // That matches: Business.ownerUserId = supabase user.id
  return { id: user.id, email: user.email }
}
