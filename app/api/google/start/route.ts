import { NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { createSupabaseServerClient } from "@/lib/supabase/server";


export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // TODO: pick workspace from session/route; v1 assumes single workspace per user
  const workspace = await prisma.workspace.findFirst({
    where: { members: { some: { userId: auth.user.id } } },
  });
  if (!workspace) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI!
  );

  const scopes = (process.env.GOOGLE_OAUTH_SCOPES || "").split(" ").filter(Boolean);

  const url = client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: scopes,
    state: workspace.id, // tie callback to workspace
  });

  return NextResponse.redirect(url);
}
