import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { Profile, Quest } from "./types";

const globalDb = globalThis as typeof globalThis & {
  sidequestDb?: DatabaseSync;
};
export function db() {
  if (globalDb.sidequestDb) return globalDb.sidequestDb;
  const path = resolve(
    /* turbopackIgnore: true */ process.env.SIDEQUEST_DB_PATH ??
      "data/sidequest.sqlite",
  );
  mkdirSync(dirname(path), { recursive: true });
  const database = new DatabaseSync(path);
  database.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS profiles (address TEXT PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS drafts (reference TEXT PRIMARY KEY, creator TEXT NOT NULL, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS quests (id TEXT PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS challenges (nonce TEXT PRIMARY KEY, address TEXT NOT NULL, message TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, address TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);`);
  globalDb.sidequestDb = database;
  return database;
}
export function getProfiles(): Profile[] {
  return db()
    .prepare("SELECT data FROM profiles")
    .all()
    .map((row) => JSON.parse(row.data as string));
}
export function getProfile(address: string): Profile | null {
  const row = db()
    .prepare("SELECT data FROM profiles WHERE address=?")
    .get(address);
  return row ? JSON.parse(row.data as string) : null;
}
export function saveProfile(profile: Profile) {
  db()
    .prepare(
      "INSERT INTO profiles VALUES (?,?) ON CONFLICT(address) DO UPDATE SET data=excluded.data",
    )
    .run(profile.address, JSON.stringify(profile));
}
export function getQuests(): Quest[] {
  return db()
    .prepare("SELECT data FROM quests")
    .all()
    .map((row) => JSON.parse(row.data as string));
}
export function saveQuest(quest: Quest) {
  const current = db()
    .prepare("SELECT data FROM quests WHERE id=?")
    .get(quest.id);
  if (
    current &&
    BigInt((JSON.parse(current.data as string) as Quest).chainVersion) >
      BigInt(quest.chainVersion)
  )
    return;
  db()
    .prepare(
      "INSERT INTO quests VALUES (?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
    )
    .run(quest.id, JSON.stringify(quest));
}
export function rateLimit(key: string, max = 30) {
  const now = Date.now();
  const row = db()
    .prepare("SELECT count,expires FROM rate_limits WHERE key=?")
    .get(key);
  if (!row || Number(row.expires) < now) {
    db()
      .prepare(
        "INSERT INTO rate_limits VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=1,expires=excluded.expires",
      )
      .run(key, now + 60_000);
    return;
  }
  if (Number(row.count) >= max)
    throw new Error("Too many requests. Please try again in a minute.");
  db().prepare("UPDATE rate_limits SET count=count+1 WHERE key=?").run(key);
}
