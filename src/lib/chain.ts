import { SuiGrpcClient } from "@mysten/sui/grpc";
import { PACKAGE_ID, RPC_URL } from "./config";
import { getDraft, getQuest, getQuests, saveQuest } from "./db";
import type { Quest } from "./types";
import { QuestBcs, QuestChangedBcs } from "./bcs";
export const chain = new SuiGrpcClient({
  network: "testnet",
  baseUrl: RPC_URL,
});

export function optionAddress(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return (value[0] as string) ?? null;
  if (value && typeof value === "object" && "vec" in value)
    return optionAddress((value as { vec: unknown }).vec);
  return null;
}
export function referenceHex(value: unknown): string {
  if (Array.isArray(value))
    return Buffer.from(value as number[]).toString("hex");
  if (typeof value === "string") {
    if (/^[0-9a-f]{64}$/i.test(value)) return value.toLowerCase();
    return Buffer.from(value, "base64").toString("hex");
  }
  throw new Error("Invalid quest reference from the chain.");
}

export async function refreshQuest(id: string) {
  const { object } = await chain.getObject({
    objectId: id,
    include: { content: true, previousTransaction: true },
  });
  if (object.type !== `${PACKAGE_ID}::quest::Quest` || !object.content)
    throw new Error("This object is not a Sidequest ticket.");
  const fields = QuestBcs.parse(object.content);
  if (Number(fields.event_id) !== 20261007)
    throw new Error("This quest belongs to a different event.");
  const reference = referenceHex(fields.reference);
  const row = await getDraft(reference);
  if (!row || row.creator !== fields.creator)
    throw new Error("Quest details are not available on this server.");
  const draft = row.data;
  const previous = await getQuest(id);
  const status = (["open", "claimed", "completed", "canceled"] as const)[
    Number(fields.status)
  ];
  if (!status) throw new Error("Unknown quest state.");
  const quest: Quest = {
    ...draft,
    id,
    reference,
    creator: String(fields.creator),
    helper: optionAddress(fields.helper),
    status,
    claimVersion: Number(fields.claim_version),
    creatorConfirmed: fields.creator_confirmed === true,
    helperConfirmed: fields.helper_confirmed === true,
    chainVersion: object.version,
    digest: object.previousTransaction ?? previous?.digest ?? "",
    completedAt:
      status === "completed" ? (previous?.completedAt ?? Date.now()) : null,
  };
  await saveQuest(quest);
  return quest;
}

export async function syncTransaction(digest: string, address: string) {
  if (!PACKAGE_ID)
    throw new Error("The testnet package has not been configured.");
  const result = await chain.waitForTransaction({
    digest,
    include: { events: true, transaction: true },
    timeout: 20_000,
  });
  if (!result.Transaction || !result.Transaction.status.success)
    throw new Error("The transaction did not succeed.");
  if (result.Transaction.transaction.sender !== address)
    throw new Error("This transaction was signed by a different wallet.");
  const events =
    result.Transaction.events?.filter(
      (e) => e.eventType === `${PACKAGE_ID}::quest::QuestChanged`,
    ) ?? [];
  if (!events.length)
    throw new Error("No Sidequest change was found in this transaction.");
  const quests: Quest[] = [];
  for (const event of events) {
    const id = QuestChangedBcs.parse(event.bcs).quest_id;
    if (typeof id !== "string")
      throw new Error("The quest event could not be read.");
    quests.push(await refreshQuest(id));
  }
  return quests;
}

let lastRefresh = 0;
let refreshInFlight: Promise<void> | null = null;
export async function refreshAll() {
  if (refreshInFlight) return refreshInFlight;
  if (Date.now() - lastRefresh < 4000) return;
  refreshInFlight = (async () => {
    const quests = (await getQuests()).filter(
      (q) => q.status === "open" || q.status === "claimed",
    );
    for (let i = 0; i < quests.length; i += 5) {
      await Promise.all(quests.slice(i, i + 5).map((q) => refreshQuest(q.id)));
    }
    lastRefresh = Date.now();
  })();
  try {
    await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}
