import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
const origin = process.env.SIDEQUEST_TEST_URL ?? "http://localhost:3100";
const signer = Ed25519Keypair.fromSecretKey(
  readFileSync(".local/demo-leo.key", "utf8").trim(),
);
async function post(
  path: string,
  data: unknown,
  cookie?: string,
  originHeader = origin,
) {
  return fetch(`${origin}${path}`, {
    method: "POST",
    headers: {
      Origin: originHeader,
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(data),
  });
}
async function challenge() {
  const response = await post("/api/auth/challenge", {
    address: signer.toSuiAddress(),
  });
  assert.equal(response.status, 200);
  return response.json() as Promise<{ nonce: string; message: string }>;
}
test("public browsing works without a wallet and identifies demo data", async () => {
  const response = await fetch(`${origin}/api/quests`);
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.address, null);
  assert.ok(data.packageId);
  assert.ok(data.profiles.length > 0);
  assert.ok(data.profiles.every((p: { demo: boolean }) => p.demo));
  assert.ok(
    data.quests.some((q: { status: string }) => q.status === "completed"),
  );
});
test("writes reject foreign origins and anonymous ownership claims", async () => {
  assert.equal(
    (await post("/api/profile", { address: signer.toSuiAddress() })).status,
    400,
  );
  const result = await post(
    "/api/auth/challenge",
    { address: signer.toSuiAddress() },
    undefined,
    "https://other.example",
  );
  assert.equal(result.status, 400);
});
test("a different signer cannot authenticate the challenged wallet", async () => {
  const data = await challenge();
  const other = new Ed25519Keypair();
  const signed = await other.signPersonalMessage(
    new TextEncoder().encode(data.message),
  );
  const response = await post("/api/auth/verify", {
    nonce: data.nonce,
    signature: signed.signature,
  });
  assert.equal(response.status, 401);
});
test("signed authentication is single-use even under concurrent replay", async () => {
  const data = await challenge();
  const signed = await signer.signPersonalMessage(
    new TextEncoder().encode(data.message),
  );
  const responses = await Promise.all([
    post("/api/auth/verify", {
      nonce: data.nonce,
      signature: signed.signature,
    }),
    post("/api/auth/verify", {
      nonce: data.nonce,
      signature: signed.signature,
    }),
  ]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 401]);
  const cookie = responses
    .find((r) => r.status === 200)!
    .headers.get("set-cookie")!
    .split(";")[0];
  const current = await (
    await fetch(`${origin}/api/profile`, { headers: { Cookie: cookie } })
  ).json();
  assert.equal(current.address, signer.toSuiAddress());
  assert.equal(current.profile.name, "Leo");
  const invalid = await post(
    "/api/quests",
    {
      title: "Tiny ask",
      ask: "Try my demo and name one unclear thing.",
      minutes: 999,
      meetingPoint: "Coffee counter",
      kind: "demo",
    },
    cookie,
  );
  assert.equal(invalid.status, 400);
  const original = current.profile;
  const input = {
    name: original.name,
    building: original.building,
    askAbout: original.askAbout,
    needsHelp: original.needsHelp,
    available: original.availableUntil > Date.now(),
    visible: false,
  };
  try {
    const hidden = await post("/api/profile", input, cookie);
    assert.equal(hidden.status, 200);
    const publicState = await (await fetch(`${origin}/api/quests`)).json();
    assert.ok(
      !publicState.profiles.some(
        (p: { address: string }) => p.address === signer.toSuiAddress(),
      ),
    );
    assert.ok(
      !publicState.quests.some(
        (q: { creator: string }) => q.creator === signer.toSuiAddress(),
      ),
    );
    const own = await (
      await fetch(`${origin}/api/profile`, { headers: { Cookie: cookie } })
    ).json();
    assert.equal(own.profile.visible, false);
  } finally {
    const restored = await post(
      "/api/profile",
      { ...input, visible: original.visible },
      cookie,
    );
    assert.equal(restored.status, 200);
  }
});
