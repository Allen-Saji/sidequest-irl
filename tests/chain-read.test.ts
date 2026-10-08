import test from "node:test";
import assert from "node:assert/strict";
import { readTransaction, readQuestObject } from "../src/lib/chain";
import { PACKAGE_ID } from "../src/lib/config";

test(
  "a failed gRPC reader falls back to a real indexed testnet receipt",
  {
    skip: process.env.SIDEQUEST_LIVE_CHAIN_TESTS !== "1",
    timeout: 30_000,
  },
  async () => {
    const digest = "EHqUvzdsSxZBvHmQaiGop6NW1RCQVXxhCHjAwqP7c6iM";
    const result = await readTransaction(digest, {
      waitForTransaction: async () => {
        throw new Error("gRPC unavailable");
      },
    });
    assert.ok(result.Transaction);
    assert.equal(result.Transaction.digest, digest);
    assert.equal(result.Transaction.status.success, true);
    assert.ok(
      result.Transaction.events.some(
        (e) => e.eventType === `${PACKAGE_ID}::quest::QuestChanged`,
      ),
    );
  },
);

test(
  "a failed object reader uses indexed BCS at the receipt's version or newer",
  {
    skip: process.env.SIDEQUEST_LIVE_CHAIN_TESTS !== "1",
    timeout: 30_000,
  },
  async () => {
    const receipt = await readTransaction(
      "EHqUvzdsSxZBvHmQaiGop6NW1RCQVXxhCHjAwqP7c6iM",
    );
    assert.ok(receipt.Transaction);
    const id =
      "0x6e48f731dc076158b42f0a01d5d886a27b3ecc2bfd4e97a001de0ba33a95c207";
    const changed = receipt.Transaction.effects.changedObjects.find(
      (o) => o.objectId === id,
    );
    assert.ok(changed?.outputVersion);
    const { object } = await readQuestObject(id, changed.outputVersion, {
      getObject: async () => {
        throw new Error("gRPC unavailable");
      },
    });
    assert.ok(BigInt(object.version) >= BigInt(changed.outputVersion));
    assert.equal(object.type, `${PACKAGE_ID}::quest::Quest`);
    assert.ok(object.content);
  },
);
