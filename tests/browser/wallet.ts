import { readFileSync } from "node:fs";
import type { BrowserContext } from "@playwright/test";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { SuiGraphQLClient } from "@mysten/sui/graphql";
import { Transaction } from "@mysten/sui/transactions";
export async function testWallet(
  context: BrowserContext,
  actor: "maya" | "leo",
  rejectSignIn = false,
) {
  const signer = Ed25519Keypair.fromSecretKey(
    readFileSync(`.local/demo-${actor}.key`, "utf8").trim(),
  );
  const client = new SuiGraphQLClient({
    network: "testnet",
    url: "https://graphql.testnet.sui.io/graphql",
  });
  // The test adapter holds keys in the Node test process. Browser pages only
  // receive public account details and wallet-standard signing responses.
  await context.exposeBinding(
    "sidequestTestSignMessage",
    async (_source, bytes: number[]) => {
      if (rejectSignIn) throw new Error("User rejected sign-in");
      return signer.signPersonalMessage(Uint8Array.from(bytes));
    },
  );
  await context.exposeBinding(
    "sidequestTestExecute",
    async (_source, json: string) => {
      const transaction = Transaction.from(json);
      const signed = await transaction.sign({ client, signer });
      const result = await client.executeTransaction({
        transaction: Buffer.from(signed.bytes, "base64"),
        signatures: [signed.signature],
        include: { effects: true },
      });
      if (!result.Transaction)
        throw new Error(
          result.FailedTransaction.status.error?.message ??
            "Transaction failed",
        );
      if (!result.Transaction.effects.bcs) throw new Error("Missing effects");
      return {
        ...signed,
        digest: result.Transaction.digest,
        effects: Buffer.from(result.Transaction.effects.bcs).toString("base64"),
      };
    },
  );
  await context.addInitScript(
    ({ address, publicKey, name }) => {
      type WalletBridge = Window & {
        sidequestTestSignMessage: (
          bytes: number[],
        ) => Promise<{ bytes: string; signature: string }>;
        sidequestTestExecute: (json: string) => Promise<{
          bytes: string;
          signature: string;
          digest: string;
          effects: string;
        }>;
      };
      const bridge = window as unknown as WalletBridge;
      const account = {
        address,
        publicKey: Uint8Array.from(publicKey),
        chains: ["sui:testnet"],
        features: [
          "sui:signPersonalMessage",
          "sui:signTransaction",
          "sui:signAndExecuteTransaction",
        ],
      };
      const wallet = {
        version: "1.0.0",
        name,
        icon: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiI+PHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiBmaWxsPSIjZGU1MTJiIi8+PC9zdmc+",
        chains: ["sui:testnet"],
        accounts: [account],
        features: {
          "standard:connect": {
            version: "1.0.0",
            connect: async () => ({ accounts: [account] }),
          },
          "standard:disconnect": {
            version: "1.0.0",
            disconnect: async () => {},
          },
          "standard:events": { version: "1.0.0", on: () => () => {} },
          "sui:signPersonalMessage": {
            version: "1.1.0",
            signPersonalMessage: async ({ message }: { message: Uint8Array }) =>
              bridge.sidequestTestSignMessage(Array.from(message)),
          },
          "sui:signTransaction": {
            version: "2.0.0",
            signTransaction: async () => {
              throw new Error("Use sign-and-execute in this test.");
            },
          },
          "sui:signAndExecuteTransaction": {
            version: "2.0.0",
            signAndExecuteTransaction: async ({
              transaction,
            }: {
              transaction: { toJSON: () => Promise<string> };
            }) => bridge.sidequestTestExecute(await transaction.toJSON()),
          },
        },
      };
      const register = (api: { register: (...wallets: unknown[]) => void }) =>
        api.register(wallet);
      window.addEventListener("wallet-standard:app-ready", (event) =>
        register((event as CustomEvent).detail),
      );
      window.dispatchEvent(
        new CustomEvent("wallet-standard:register-wallet", {
          detail: register,
        }),
      );
    },
    {
      address: signer.toSuiAddress(),
      publicKey: Array.from(signer.getPublicKey().toRawBytes()),
      name: `Sidequest Test ${actor}`,
    },
  );
  return signer.toSuiAddress();
}
