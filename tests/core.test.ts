import test from "node:test";
import assert from "node:assert/strict";
import { questSchema, profileSchema } from "../src/lib/validation";
import { QuestBcs, QuestChangedBcs } from "../src/lib/bcs";
import { optionAddress, referenceHex } from "../src/lib/chain";
import {
  createQuestTransaction,
  questTransaction,
} from "../src/lib/transactions";
const address = `0x${"a".repeat(64)}`;
const second = `0x${"b".repeat(64)}`;
test("profile visibility and availability require explicit booleans", () => {
  assert.equal(
    profileSchema.safeParse({ name: "Maya", building: "Music apps" }).success,
    false,
  );
  assert.equal(
    profileSchema.safeParse({
      name: "Maya",
      building: "Music apps",
      askAbout: "",
      needsHelp: "",
      available: false,
      visible: false,
    }).success,
    true,
  );
});
test("quests reject unbounded asks, invalid duration, and missing meeting points", () => {
  const valid = {
    title: "Find my pitch gap",
    ask: "Listen to my pitch and name one unclear thing.",
    minutes: 5,
    meetingPoint: "Coffee counter",
    kind: "pitch",
  };
  assert.equal(questSchema.safeParse(valid).success, true);
  for (const patch of [
    { ask: "a".repeat(281) },
    { minutes: 0 },
    { minutes: 31 },
    { meetingPoint: "" },
    { kind: "payment" },
  ])
    assert.equal(questSchema.safeParse({ ...valid, ...patch }).success, false);
});
test("BCS parses exact participant and confirmation state without JSON transport assumptions", () => {
  const fields = {
    id: address,
    creator: address,
    helper: second,
    event_id: "20261007",
    reference: Array(32).fill(6),
    status: 1,
    claim_version: "3",
    creator_confirmed: false,
    helper_confirmed: true,
  };
  const parsed = QuestBcs.parse(QuestBcs.serialize(fields).toBytes());
  assert.equal(parsed.creator, address);
  assert.equal(parsed.helper, second);
  assert.equal(parsed.creator_confirmed, false);
  assert.equal(parsed.helper_confirmed, true);
  assert.equal(referenceHex(parsed.reference), "06".repeat(32));
  const event = {
    quest_id: address,
    creator: address,
    helper: null,
    reference: fields.reference,
    status: 0,
    claim_version: "0",
  };
  assert.equal(
    QuestChangedBcs.parse(QuestChangedBcs.serialize(event).toBytes()).helper,
    null,
  );
});
test("reference decoding and optional address parsing preserve absence", () => {
  assert.equal(optionAddress(null), null);
  assert.equal(optionAddress({ vec: [] }), null);
  assert.equal(optionAddress([second]), second);
  assert.equal(
    referenceHex(Buffer.alloc(32, 2).toString("base64")),
    "02".repeat(32),
  );
});
test("every mutation binds to the supplied claim version and testnet package", () => {
  const data = questTransaction(
    "confirm",
    { id: second, claimVersion: 12 },
    address,
  ).getData();
  const command = data.commands[0];
  assert.equal(command.$kind, "MoveCall");
  if (command.$kind === "MoveCall") {
    assert.equal(command.MoveCall.package, address);
    assert.equal(command.MoveCall.function, "confirm");
  }
  assert.throws(() => createQuestTransaction("bad", address));
});
