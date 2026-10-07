import { z } from "zod";
import { cookies } from "next/headers";
import { isValidPersonalMessageSignature } from "@mysten/sui/verify";
import { db } from "@/lib/db";
import {
  body,
  checkOrigin,
  apiError,
  newSession,
  SESSION_COOKIE,
  tokenHash,
  requestOrigin,
} from "@/lib/auth";
import { chain } from "@/lib/chain";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { nonce, signature } = z
      .object({
        nonce: z.string().regex(/^[0-9a-f]{48}$/),
        signature: z.string().max(5000),
      })
      .parse(await body(request));
    const row = db()
      .prepare("SELECT * FROM challenges WHERE nonce=? AND expires>?")
      .get(nonce, Date.now());
    if (!row) throw new Error("Sign-in expired. Please try again.");
    const valid = await isValidPersonalMessageSignature(
      new TextEncoder().encode(row.message as string),
      signature,
      { address: row.address as string, client: chain },
    );
    if (!valid) throw new Error("The wallet signature could not be verified.");
    const consumed = db()
      .prepare("DELETE FROM challenges WHERE nonce=?")
      .run(nonce);
    if (!consumed.changes)
      throw new Error("This sign-in request was already used.");
    const token = newSession(row.address as string);
    (await cookies()).set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "strict",
      secure: new URL(requestOrigin(request)).protocol === "https:",
      path: "/",
      maxAge: 86400,
    });
    return Response.json({ address: row.address });
  } catch (error) {
    return apiError(error, 401);
  }
}
export async function DELETE(request: Request) {
  try {
    checkOrigin(request);
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    if (token)
      db().prepare("DELETE FROM sessions WHERE token=?").run(tokenHash(token));
    jar.delete(SESSION_COOKIE);
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
