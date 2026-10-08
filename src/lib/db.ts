import postgres from "postgres";
import type { Profile, Quest } from "./types";

const globalDb = globalThis as typeof globalThis & {
  sidequestSql?: ReturnType<typeof postgres>;
};
export function db() {
  if (globalDb.sidequestSql) return globalDb.sidequestSql;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Supabase storage has not been configured.");
  globalDb.sidequestSql = postgres(url, {
    max: 3,
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: {
      rejectUnauthorized: true,
      ...(process.env.DATABASE_CA_CERT
        ? { ca: process.env.DATABASE_CA_CERT }
        : {}),
    },
    onnotice: () => {},
  });
  return globalDb.sidequestSql;
}
async function storage<T>(query: PromiseLike<T>): Promise<T> {
  try {
    return await query;
  } catch {
    // Database diagnostics can contain connection details. Keep them off the API.
    throw new Error("Storage is temporarily unavailable. Please try again.");
  }
}
export async function getProfiles(): Promise<Profile[]> {
  const rows = await storage(
    db()`SELECT data FROM sidequest.profiles ORDER BY address`,
  );
  return rows.map((r) => r.data as Profile);
}
export async function getProfile(address: string): Promise<Profile | null> {
  const [row] = await storage(
    db()`SELECT data FROM sidequest.profiles WHERE address=${address}`,
  );
  return row ? (row.data as Profile) : null;
}
export async function saveProfile(profile: Profile) {
  const sql = db();
  await storage(sql`INSERT INTO sidequest.profiles (address,data) VALUES (${profile.address},${sql.json(profile)})
    ON CONFLICT (address) DO UPDATE SET data=EXCLUDED.data`);
}
export async function getQuests(): Promise<Quest[]> {
  const rows = await storage(
    db()`SELECT data FROM sidequest.quests ORDER BY created_at,id`,
  );
  return rows.map((r) => r.data as Quest);
}
export async function getQuest(id: string): Promise<Quest | null> {
  const [row] = await storage(
    db()`SELECT data FROM sidequest.quests WHERE id=${id}`,
  );
  return row ? (row.data as Quest) : null;
}
export async function saveQuest(quest: Quest) {
  const sql = db();
  await storage(sql`INSERT INTO sidequest.quests (id,data,chain_version)
    VALUES (${quest.id},${sql.json(quest)},${quest.chainVersion})
    ON CONFLICT (id) DO UPDATE SET data=EXCLUDED.data,chain_version=EXCLUDED.chain_version
    WHERE EXCLUDED.chain_version >= sidequest.quests.chain_version`);
}
export type Draft = Pick<
  Quest,
  | "title"
  | "ask"
  | "minutes"
  | "meetingPoint"
  | "kind"
  | "reference"
  | "createdAt"
  | "demo"
>;
export async function saveDraft(
  reference: string,
  creator: string,
  data: Draft,
) {
  const sql = db();
  await storage(sql`INSERT INTO sidequest.drafts (reference,creator,data) VALUES (${reference},${creator},${sql.json(data)})
    ON CONFLICT (reference) DO NOTHING`);
}
export async function getDraft(reference: string) {
  const [row] = await storage(
    db()`SELECT creator,data FROM sidequest.drafts WHERE reference=${reference}`,
  );
  return row
    ? { creator: row.creator as string, data: row.data as Draft }
    : null;
}
export async function saveChallenge(
  nonce: string,
  address: string,
  message: string,
  expires: number,
) {
  await storage(
    db()`INSERT INTO sidequest.challenges (nonce,address,message,expires) VALUES (${nonce},${address},${message},${expires})`,
  );
}
export async function getChallenge(nonce: string) {
  const [row] = await storage(
    db()`SELECT address,message FROM sidequest.challenges WHERE nonce=${nonce} AND expires>${Date.now()}`,
  );
  return row
    ? { address: row.address as string, message: row.message as string }
    : null;
}
export async function consumeChallenge(nonce: string) {
  const rows = await storage(
    db()`DELETE FROM sidequest.challenges WHERE nonce=${nonce} AND expires>${Date.now()} RETURNING nonce`,
  );
  return rows.length === 1;
}
export async function getSession(token: string): Promise<string | null> {
  const [row] = await storage(
    db()`SELECT address FROM sidequest.sessions WHERE token=${token} AND expires>${Date.now()}`,
  );
  return row ? (row.address as string) : null;
}
export async function saveSession(
  token: string,
  address: string,
  expires: number,
) {
  await storage(
    db()`INSERT INTO sidequest.sessions (token,address,expires) VALUES (${token},${address},${expires})`,
  );
}
export async function deleteSession(token: string) {
  await storage(db()`DELETE FROM sidequest.sessions WHERE token=${token}`);
}
let lastCleanup = 0;
async function pruneExpired(now: number) {
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;
  try {
    await storage(
      db().begin(async (sql) => {
        await sql`DELETE FROM sidequest.challenges WHERE expires<=${now}`;
        await sql`DELETE FROM sidequest.sessions WHERE expires<=${now}`;
        await sql`DELETE FROM sidequest.rate_limits WHERE expires<=${now}`;
      }),
    );
  } catch (error) {
    lastCleanup = 0;
    throw error;
  }
}
export async function rateLimit(key: string, max = 30) {
  const now = Date.now();
  await pruneExpired(now);
  const [row] =
    await storage(db()`INSERT INTO sidequest.rate_limits (key,count,expires) VALUES (${key},1,${now + 60_000})
    ON CONFLICT (key) DO UPDATE SET
      count=CASE WHEN sidequest.rate_limits.expires<=${now} THEN 1 ELSE sidequest.rate_limits.count+1 END,
      expires=CASE WHEN sidequest.rate_limits.expires<=${now} THEN EXCLUDED.expires ELSE sidequest.rate_limits.expires END
    RETURNING count`);
  if (Number(row.count) > max)
    throw new Error("Too many requests. Please try again in a minute.");
}
export async function storageHealth() {
  await storage(db()`SELECT 1 FROM sidequest.profiles LIMIT 1`);
}
export async function closeStorage() {
  if (globalDb.sidequestSql) await globalDb.sidequestSql.end({ timeout: 5 });
  globalDb.sidequestSql = undefined;
}
