import { NextResponse } from "next/server"
import { getServerUser } from "@/server/auth/getServerUser"

export async function GET() {
  const user = await getServerUser()
  return NextResponse.json({ user })
}
