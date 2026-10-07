import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { Transaction } from "@mysten/sui/transactions";
import { client, execute, localKey } from "./testnet";

process.loadEnvFile(".env.local");
if (existsSync(".local/chain-smoke.json")) {
  console.log(
    "A completed smoke run already exists in .local/chain-smoke.json.",
  );
  process.exit(0);
}
const { db, saveProfile } = await import("../src/lib/db");
const { refreshQuest, syncTransaction } = await import("../src/lib/chain");
const { createQuestTransaction, questTransaction } =
  await import("../src/lib/transactions");
const { QuestChangedBcs } = await import("../src/lib/bcs");
const deployment = JSON.parse(readFileSync(".local/deployment.json", "utf8"));
const deployer = localKey("deployer");
const creator = localKey("demo-maya");
const helper = localKey("demo-leo");
const outsider = localKey("demo-niko");
const actors = [creator, helper, outsider];
const funding = new Transaction();
let needsFunding = false;
for (const actor of actors) {
  const { balance } = await client.getBalance({ owner: actor.toSuiAddress() });
  if (BigInt(balance.balance) < 50_000_000n) {
    const [coin] = funding.splitCoins(funding.gas, [150_000_000]);
    funding.transferObjects([coin], actor.toSuiAddress());
    needsFunding = true;
  }
}
if (needsFunding) await execute(funding, deployer);
const profiles = [
  {
    name: "Maya",
    building: "Building a tiny music app",
    askAbout: "Music apps and getting an idea across",
    needsHelp: "Help me sharpen my pitch.",
    color: 0,
  },
  {
    name: "Leo",
    building: "Learning Move, one object at a time",
    askAbout: "Frontend, TypeScript, and good coffee",
    needsHelp: "Explain shared objects to me.",
    color: 1,
  },
  {
    name: "Niko",
    building: "Making a game you can play together",
    askAbout: "Onchain games and small prototypes",
    needsHelp: "Try my demo. Tell me where it gets confusing.",
    color: 2,
  },
];
actors.forEach((actor, i) =>
  saveProfile({
    ...profiles[i],
    address: actor.toSuiAddress(),
    demo: true,
    visible: true,
    availableUntil: 0,
  }),
);
const records: { step: string; digest?: string; questId?: string }[] = [];
async function create(
  signer: typeof creator,
  metadata: { title: string; ask: string; kind: string; minutes?: number },
) {
  const reference = randomBytes(32).toString("hex");
  const draft = {
    ...metadata,
    minutes: metadata.minutes ?? 5,
    meetingPoint: "Near the coffee counter",
    reference,
    createdAt: Date.now(),
    demo: true,
  };
  db()
    .prepare("INSERT INTO drafts VALUES (?,?,?)")
    .run(reference, signer.toSuiAddress(), JSON.stringify(draft));
  const tx = await execute(createQuestTransaction(reference), signer);
  const event = tx.events.find(
    (e) => e.eventType === `${deployment.packageId}::quest::QuestChanged`,
  );
  assert.ok(event);
  const id = QuestChangedBcs.parse(event.bcs).quest_id;
  const quest = await refreshQuest(id);
  records.push({ step: metadata.title, digest: tx.digest, questId: id });
  return quest;
}
async function change(
  action: "claim" | "confirm" | "release" | "cancel",
  quest: Awaited<ReturnType<typeof create>>,
  signer: typeof creator,
) {
  const result = await execute(questTransaction(action, quest), signer);
  const [updated] = await syncTransaction(result.digest, signer.toSuiAddress());
  records.push({ step: action, digest: result.digest, questId: updated.id });
  return updated;
}
async function mustFail(
  action: "claim" | "confirm" | "release" | "cancel",
  quest: Awaited<ReturnType<typeof create>>,
  signer: typeof creator,
) {
  const transaction = questTransaction(action, quest);
  transaction.setSender(signer.toSuiAddress());
  const result = await client.simulateTransaction({ transaction });
  assert.equal(result.$kind, "FailedTransaction", `${action} should fail`);
  records.push({
    step: `Rejected ${action} from ${signer.toSuiAddress().slice(0, 8)}`,
    questId: quest.id,
  });
}
let q = await create(creator, {
  title: "Find the hole in my pitch",
  ask: "Hear my 30-second pitch. Tell me the first unclear thing.",
  kind: "pitch",
});
await mustFail("claim", q, creator);
q = await change("claim", q, helper);
assert.equal(q.status, "claimed");
await mustFail("confirm", q, outsider);
await mustFail("release", q, outsider);
await mustFail("cancel", q, outsider);
q = await change("confirm", q, helper);
assert.equal(q.status, "claimed");
assert.equal(q.helperConfirmed, true);
assert.equal(q.creatorConfirmed, false);
await mustFail("confirm", q, helper);
q = await change("confirm", q, creator);
assert.equal(q.status, "completed");
await mustFail("cancel", q, creator);
await mustFail("confirm", q, creator);
await mustFail("release", q, helper);
const completed = q;

let reopened = await create(helper, {
  title: "A ticket for state checks",
  ask: "Exercise release and stale confirmations using test actors.",
  kind: "debug",
});
const stale = await change("claim", reopened, creator);
reopened = await change("confirm", stale, helper);
reopened = await change("release", reopened, creator);
assert.equal(reopened.creatorConfirmed, false);
assert.equal(reopened.helperConfirmed, false);
reopened = await change("claim", reopened, outsider);
await mustFail("confirm", stale, creator);
await mustFail("confirm", reopened, creator);
reopened = await change("cancel", reopened, helper);
assert.equal(reopened.status, "canceled");
await mustFail("claim", reopened, creator);

const race = await create(creator, {
  title: "A ticket for a claim race",
  ask: "Two test actors race to become the only active helper.",
  kind: "debug",
});
const outcomes = await Promise.allSettled([
  execute(questTransaction("claim", race), helper),
  execute(questTransaction("claim", race), outsider),
]);
assert.equal(outcomes.filter((r) => r.status === "fulfilled").length, 1);
const raced = await refreshQuest(race.id);
assert.ok(
  [helper.toSuiAddress(), outsider.toSuiAddress()].includes(raced.helper!),
);
assert.equal(raced.status, "claimed");
await change("cancel", raced, creator);
records.push({
  step: "Concurrent claim: exactly one winner",
  questId: race.id,
});

const open = await create(creator, {
  title: "Find the hole in my pitch",
  ask: "Hear my 30-second pitch. Tell me the first unclear thing.",
  kind: "pitch",
});
await create(helper, {
  title: "Explain shared objects to me",
  ask: "Give me a simple analogy I can actually remember.",
  kind: "learn",
});
await create(outsider, {
  title: "Be my demo detective",
  ask: "Try one screen and tell me where you get confused.",
  kind: "demo",
  minutes: 10,
});
writeFileSync(
  ".local/chain-smoke.json",
  JSON.stringify(
    {
      network: "testnet",
      packageId: deployment.packageId,
      completedQuestId: completed.id,
      openQuestId: open.id,
      completedAt: new Date().toISOString(),
      records,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify(
    {
      success: true,
      completedQuestId: completed.id,
      openQuestId: open.id,
      checks: records.length,
      network: "testnet",
    },
    null,
    2,
  ),
);
