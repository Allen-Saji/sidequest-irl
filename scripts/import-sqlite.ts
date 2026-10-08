import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Profile, Quest } from "../src/lib/types";
import {
  saveProfile,
  saveDraft,
  saveQuest,
  closeStorage,
  type Draft,
} from "../src/lib/db";

process.loadEnvFile(".env.local");
const source = resolve(process.argv[2] ?? "data/sidequest.sqlite");
if (!existsSync(source)) throw new Error("The SQLite source does not exist.");
const database = new DatabaseSync(source, { readOnly: true });
try {
  const profiles = database.prepare("SELECT data FROM profiles").all();
  const drafts = database
    .prepare("SELECT reference,creator,data FROM drafts")
    .all();
  const quests = database.prepare("SELECT data FROM quests").all();
  for (const row of profiles)
    await saveProfile(JSON.parse(row.data as string) as Profile);
  for (const row of drafts)
    await saveDraft(
      row.reference as string,
      row.creator as string,
      JSON.parse(row.data as string) as Draft,
    );
  for (const row of quests)
    await saveQuest(JSON.parse(row.data as string) as Quest);
  console.log(
    JSON.stringify({
      imported: {
        profiles: profiles.length,
        drafts: drafts.length,
        quests: quests.length,
      },
    }),
  );
} finally {
  database.close();
  await closeStorage();
}
