import { Transaction } from "@mysten/sui/transactions";
import type { Quest } from "./types";
import { PACKAGE_ID } from "./config";
export function createQuestTransaction(
  reference: string,
  packageId = PACKAGE_ID,
) {
  if (!packageId) throw new Error("The testnet package is not configured.");
  const tx = new Transaction();
  const bytes = reference.match(/.{2}/g)?.map((byte) => parseInt(byte, 16));
  if (!bytes || bytes.length !== 32)
    throw new Error("Invalid quest reference.");
  tx.moveCall({
    target: `${packageId}::quest::create`,
    arguments: [tx.pure.vector("u8", bytes)],
  });
  return tx;
}
export function questTransaction(
  action: "claim" | "confirm" | "release" | "cancel",
  quest: Pick<Quest, "id" | "claimVersion">,
  packageId = PACKAGE_ID,
) {
  if (!packageId) throw new Error("The testnet package is not configured.");
  const tx = new Transaction();
  tx.moveCall({
    target: `${packageId}::quest::${action}`,
    arguments: [tx.object(quest.id), tx.pure.u64(quest.claimVersion)],
  });
  return tx;
}
