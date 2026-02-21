import { NextResponse } from "next/server"
import { createState } from "@/server/google/state"
import { prisma } from "@/server/prisma"
import { getServerUser } from "@/server/auth/getServerUser" // adjust if needed

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const businessId = searchParams.get("businessId")

  if (!businessId) {
    return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
  }

  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Verify business ownership
  const business = await prisma.business.findFirst({
    where: {
      id: businessId,
      ownerUserId: user.id,
    },
  })

  if (!business) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 })
  }

  const state = createState({
    businessId,
    userId: user.id,
    ts: Date.now(),
  })

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_OAUTH_REDIRECT_URI!,
    response_type: "code",
    scope: [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/business.manage",
    ].join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  })

  const googleUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`

  return NextResponse.redirect(googleUrl)
}
