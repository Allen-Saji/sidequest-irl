export type QuestKind = "pitch" | "debug" | "learn" | "demo";
export type Profile = {
  address: string;
  name: string;
  building: string;
  askAbout: string;
  needsHelp: string;
  availableUntil: number;
  visible: boolean;
  demo: boolean;
  color: number;
};
export type Quest = {
  id: string;
  reference: string;
  creator: string;
  helper: string | null;
  title: string;
  ask: string;
  minutes: number;
  meetingPoint: string;
  kind: QuestKind;
  status: "open" | "claimed" | "completed" | "canceled";
  claimVersion: number;
  creatorConfirmed: boolean;
  helperConfirmed: boolean;
  chainVersion: string;
  digest: string;
  createdAt: number;
  completedAt: number | null;
  demo: boolean;
};
export type AppState = {
  profiles: Profile[];
  quests: Quest[];
  address: string | null;
  packageId: string;
  chainError?: string;
};
export const EVENT = {
  name: "Sui Basecamp",
  label: "BASECAMP / OCT 07-08",
  id: 20261007,
};
export const KIND_LABELS: Record<QuestKind, string> = {
  pitch: "Pitch feedback",
  debug: "Bug rescue",
  learn: "Explain a thing",
  demo: "Try my demo",
};
export function ticketCode(quest: Quest) {
  return `Q-${quest.reference.slice(0, 6).toUpperCase()}-${quest.claimVersion}`;
}
export function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
