import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  db,
  getQuest,
  saveQuest,
  getChallenge,
  saveChallenge,
  consumeChallenge,
  rateLimit,
  closeStorage,
} from "../src/lib/db";
import type { Quest } from "../src/lib/types";

test(
  "Supabase preserves versions and atomically consumes challenges and rate budgets",
  {
    skip: !process.env.DATABASE_URL,
  },
  async () => {
    const sql = db();
    const suffix = randomBytes(32).toString("hex");
    const id = `0x${suffix}`;
    const nonce = suffix.slice(0, 48);
    const key = `storage-test:${suffix}`;
    const quest: Quest = {
      id,
      reference: suffix,
      creator: id,
      helper: null,
      title: "Storage verification",
      ask: "Internal storage verification",
      minutes: 5,
      meetingPoint: "Test",
      kind: "debug",
      status: "open",
      claimVersion: 0,
      creatorConfirmed: false,
      helperConfirmed: false,
      chainVersion: "10",
      digest: "test",
      createdAt: Date.now(),
      completedAt: null,
      demo: true,
    };
    try {
      await Promise.all(
        [10, 9, 15, 11, 8].map((version) =>
          saveQuest({ ...quest, chainVersion: String(version) }),
        ),
      );
      assert.equal((await getQuest(id))?.chainVersion, "15");
      await saveChallenge(nonce, id, "Test challenge", Date.now() + 60_000);
      assert.equal((await getChallenge(nonce))?.address, id);
      const consumed = await Promise.all(
        Array.from({ length: 5 }, () => consumeChallenge(nonce)),
      );
      assert.equal(consumed.filter(Boolean).length, 1);
      assert.equal(await getChallenge(nonce), null);
      const limits = await Promise.allSettled(
        Array.from({ length: 8 }, () => rateLimit(key, 3)),
      );
      assert.equal(limits.filter((r) => r.status === "fulfilled").length, 3);
      const [role] =
        await sql`SELECT rolsuper,rolbypassrls,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user`;
      assert.equal(role.rolsuper, false);
      assert.equal(role.rolbypassrls, false);
      assert.equal(role.rolcreatedb, false);
      assert.equal(role.rolcreaterole, false);
      const [access] =
        await sql`SELECT has_schema_privilege('anon','sidequest','USAGE') AS anonymous, has_schema_privilege('authenticated','sidequest','USAGE') AS authenticated`;
      assert.equal(access.anonymous, false);
      assert.equal(access.authenticated, false);
      const publicAccess =
        await sql`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind='r'
      AND has_table_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,DELETE')`;
      assert.equal(
        publicAccess.length,
        0,
        "Sidequest cannot access another application's tables",
      );
      await assert.rejects(
        sql`SELECT 1 FROM public.jobs LIMIT 0`,
        (error: unknown) =>
          !!error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "42501",
      );
    } finally {
      await sql`DELETE FROM sidequest.quests WHERE id=${id}`;
      await sql`DELETE FROM sidequest.challenges WHERE nonce=${nonce}`;
      await sql`DELETE FROM sidequest.rate_limits WHERE key=${key}`;
      await closeStorage();
    }
  },
);
