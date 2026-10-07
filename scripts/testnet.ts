import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import "./native-faucet";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { getFaucetHost, requestSuiFromFaucetV3 } from "@mysten/sui/faucet";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { Transaction } from "@mysten/sui/transactions";
export const client = new SuiGrpcClient({
  network: "testnet",
  baseUrl: "https://fullnode.testnet.sui.io:443",
});
export function localKey(name: string) {
  mkdirSync(".local", { recursive: true, mode: 0o700 });
  const path = `.local/${name}.key`;
  if (existsSync(path))
    return Ed25519Keypair.fromSecretKey(readFileSync(path, "utf8").trim());
  const key = new Ed25519Keypair();
  writeFileSync(path, key.getSecretKey(), { mode: 0o600, flag: "wx" });
  console.log(`Created local testnet actor ${name}: ${key.toSuiAddress()}`);
  return key;
}
export async function fund(key: Ed25519Keypair) {
  const { balance } = await client.getBalance({ owner: key.toSuiAddress() });
  if (BigInt(balance.balance) >= 50_000_000n) return;
  console.log(`Requesting testnet faucet gas for ${key.toSuiAddress()}`);
  await requestSuiFromFaucetV3({
    host: getFaucetHost("testnet"),
    recipient: key.toSuiAddress(),
    timeout: 180_000,
  });
}
export async function execute(tx: Transaction, signer: Ed25519Keypair) {
  const result = await client.signAndExecuteTransaction({
    transaction: tx,
    signer,
    include: { effects: true, events: true, transaction: true },
  });
  if (result.FailedTransaction)
    throw new Error(
      result.FailedTransaction.status.error?.message ?? "Transaction failed.",
    );
  const confirmed = await client.waitForTransaction({
    digest: result.Transaction.digest,
    include: { effects: true, events: true, transaction: true },
  });
  if (!confirmed.Transaction)
    throw new Error("Transaction verification failed.");
  return confirmed.Transaction;
}
