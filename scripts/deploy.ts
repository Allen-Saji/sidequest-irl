import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { Transaction } from "@mysten/sui/transactions";
import { client, execute, fund, localKey } from "./testnet";
if (existsSync(".local/deployment.json")) {
  console.log(
    "A local deployment already exists. Review .local/deployment.json instead of publishing again.",
  );
  process.exit(0);
}
const key = localKey("deployer");
await fund(key);
const build = JSON.parse(
  execFileSync(
    "sui",
    [
      "move",
      "build",
      "--dump-bytecode-as-base64",
      "--no-tree-shaking",
      "--path",
      "contracts/sidequest",
    ],
    { encoding: "utf8", maxBuffer: 10_000_000 },
  ),
);
const tx = new Transaction();
const [upgradeCap] = tx.publish({
  modules: build.modules,
  dependencies: build.dependencies,
});
tx.transferObjects([upgradeCap], key.toSuiAddress());
const result = await execute(tx, key);
const packages = result.effects.changedObjects.filter(
  (o) => o.outputState === "PackageWrite",
);
if (packages.length !== 1)
  throw new Error("Could not identify the published package.");
const packageId = packages[0].objectId;
const deployment = {
  network: "testnet",
  packageId,
  digest: result.digest,
  deployer: key.toSuiAddress(),
  deployedAt: new Date().toISOString(),
};
writeFileSync(".local/deployment.json", JSON.stringify(deployment, null, 2));
writeFileSync(".env.local", `NEXT_PUBLIC_SUI_PACKAGE_ID=${packageId}\n`);
await client.getObject({ objectId: packageId });
console.log(JSON.stringify(deployment, null, 2));
