import { createDAppKit } from "@mysten/dapp-kit-react";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { RPC_URL } from "./config";
export const dAppKit = createDAppKit({
  networks: ["testnet"],
  defaultNetwork: "testnet",
  createClient: () =>
    new SuiGrpcClient({ network: "testnet", baseUrl: RPC_URL }),
});
declare module "@mysten/dapp-kit-react" {
  interface Register {
    dAppKit: typeof dAppKit;
  }
}
