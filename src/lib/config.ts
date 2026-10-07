export const NETWORK = "testnet" as const;
export const RPC_URL = "https://fullnode.testnet.sui.io:443";
export const PACKAGE_ID = process.env.NEXT_PUBLIC_SUI_PACKAGE_ID ?? "";
export function explorerObject(id: string) {
  return `https://suiscan.xyz/testnet/object/${id}`;
}
export function explorerTransaction(digest: string) {
  return `https://suiscan.xyz/testnet/tx/${digest}`;
}
