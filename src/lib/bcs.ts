import { bcs } from "@mysten/sui/bcs";
export const QuestBcs = bcs.struct("Quest", {
  id: bcs.Address,
  creator: bcs.Address,
  helper: bcs.option(bcs.Address),
  event_id: bcs.u64(),
  reference: bcs.vector(bcs.u8()),
  status: bcs.u8(),
  claim_version: bcs.u64(),
  creator_confirmed: bcs.bool(),
  helper_confirmed: bcs.bool(),
});
export const QuestChangedBcs = bcs.struct("QuestChanged", {
  quest_id: bcs.Address,
  creator: bcs.Address,
  helper: bcs.option(bcs.Address),
  reference: bcs.vector(bcs.u8()),
  status: bcs.u8(),
  claim_version: bcs.u64(),
});
