import { randomBytes, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";
export const SESSION_COOKIE = "sidequest_session";
export function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export async function sessionAddress(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = db()
    .prepare("SELECT address FROM sessions WHERE token=? AND expires>?")
    .get(tokenHash(token), Date.now());
  return (row?.address as string) ?? null;
}
export async function requireSession() {
  const address = await sessionAddress();
  if (!address) throw new Error("Sign in with your wallet first.");
  return address;
}
export function newSession(address: string) {
  const token = randomBytes(32).toString("hex");
  db()
    .prepare("INSERT INTO sessions VALUES (?,?,?)")
    .run(tokenHash(token), address, Date.now() + 24 * 60 * 60 * 1000);
  return token;
}
export function requestOrigin(request: Request) {
  if (process.env.SIDEQUEST_ORIGIN)
    return new URL(process.env.SIDEQUEST_ORIGIN).origin;
  const url = new URL(request.url);
  const host = request.headers.get("host");
  if (!host) throw new Error("The request is missing its host.");
  return `${url.protocol}//${host}`;
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== requestOrigin(request))
    throw new Error("Please use this app to submit changes.");
}
export async function body(request: Request) {
  const text = await request.text();
  if (text.length > 12_000) throw new Error("This request is too large.");
  return JSON.parse(text);
}
export function apiError(error: unknown, status = 400) {
  return Response.json(
    {
      error:
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
    },
    { status },
  );
}
