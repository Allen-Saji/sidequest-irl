import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db, rateLimit } from "@/lib/db";
import { checkOrigin, body, apiError, requestOrigin } from "@/lib/auth";
import { addressSchema } from "@/lib/validation";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { address } = z
      .object({ address: addressSchema })
      .parse(await body(request));
    rateLimit(`challenge:${address}`, 10);
    const nonce = randomBytes(24).toString("hex");
    const expires = Date.now() + 5 * 60_000;
    const message = `Sign in to Sidequest IRL\nOrigin: ${requestOrigin(request)}\nNetwork: Sui testnet\nWallet: ${address}\nNonce: ${nonce}\nExpires: ${new Date(expires).toISOString()}\nThis proves wallet ownership. No funds will be transferred.`;
    db()
      .prepare("INSERT INTO challenges VALUES (?,?,?,?)")
      .run(nonce, address, message, expires);
    return Response.json({ nonce, message });
  } catch (error) {
    return apiError(error);
  }
}
