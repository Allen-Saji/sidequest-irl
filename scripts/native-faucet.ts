// The Sui SDK uses native Node argon2 when available. Provide the same
// callback API on Node 22 so the public faucet proof fits its time window.
// This adapter is only used by local testnet scripts, never the web app.
import { hashRaw } from "@node-rs/argon2";
type Parameters = {
  message: string;
  nonce: string;
  parallelism: number;
  tagLength: number;
  memory: number;
  passes: number;
};
type Callback = (error: Error | null, hash: Uint8Array) => void;
const cryptoModule = process.getBuiltinModule(
  "node:crypto",
) as typeof import("node:crypto") & {
  argon2?: (
    algorithm: string,
    parameters: Parameters,
    callback: Callback,
  ) => void;
};
if (!cryptoModule.argon2)
  cryptoModule.argon2 = (_algorithm, parameters, callback) => {
    hashRaw(parameters.message, {
      salt: Buffer.from(parameters.nonce),
      algorithm: 0,
      version: 1,
      memoryCost: parameters.memory,
      timeCost: parameters.passes,
      parallelism: parameters.parallelism,
      outputLen: parameters.tagLength,
    }).then(
      (hash) => callback(null, hash),
      (error) => callback(error, new Uint8Array()),
    );
  };
