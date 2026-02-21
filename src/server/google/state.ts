import crypto from "crypto"

const SECRET = process.env.OAUTH_STATE_SECRET!

export function createState(payload: object) {
  const json = JSON.stringify(payload)
  const hmac = crypto
    .createHmac("sha256", SECRET)
    .update(json)
    .digest("hex")

  const base = Buffer.from(json).toString("base64")
  return `${base}.${hmac}`
}

export function verifyState(state: string) {
  const [base, hmac] = state.split(".")
  const json = Buffer.from(base, "base64").toString("utf8")

  const expected = crypto
    .createHmac("sha256", SECRET)
    .update(json)
    .digest("hex")

  if (hmac !== expected) {
    throw new Error("Invalid OAuth state")
  }

  return JSON.parse(json)
}
