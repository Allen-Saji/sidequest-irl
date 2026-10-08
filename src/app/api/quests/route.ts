import { randomBytes } from "node:crypto";
import {
  saveDraft,
  getProfiles,
  getProfile,
  getQuests,
  rateLimit,
} from "@/lib/db";
import {
  body,
  checkOrigin,
  requireSession,
  sessionAddress,
  apiError,
} from "@/lib/auth";
import { questSchema } from "@/lib/validation";
import { PACKAGE_ID } from "@/lib/config";
import { refreshAll } from "@/lib/chain";
export const dynamic = "force-dynamic";
export async function GET() {
  let chainError: string | undefined;
  try {
    await refreshAll();
  } catch {
    chainError =
      "Could not refresh testnet state. Reconnect before taking action.";
  }
  const address = await sessionAddress();
  const allProfiles = await getProfiles();
  const profiles = allProfiles.filter(
    (p) => p.visible || p.address === address,
  );
  const visible = new Set(profiles.map((p) => p.address));
  const demoAddresses = new Set(
    allProfiles.filter((p) => p.demo).map((p) => p.address),
  );
  const quests = (await getQuests())
    .filter(
      (q) => visible.has(q.creator) || (!!address && q.helper === address),
    )
    .map((q) => ({
      ...q,
      demo:
        q.demo ||
        demoAddresses.has(q.creator) ||
        (!!q.helper && demoAddresses.has(q.helper)),
    }));
  return Response.json({
    profiles,
    quests,
    address,
    packageId: PACKAGE_ID,
    chainError,
  });
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const address = await requireSession();
    await rateLimit(`quest:${address}`, 10);
    const profile = await getProfile(address);
    if (!profile?.visible)
      throw new Error(
        "Join the event with a visible profile before creating a quest.",
      );
    const data = questSchema.parse(await body(request));
    const reference = randomBytes(32).toString("hex");
    const draft = {
      ...data,
      reference,
      createdAt: Date.now(),
      demo: profile?.demo ?? false,
    };
    await saveDraft(reference, address, draft);
    return Response.json({ reference });
  } catch (error) {
    return apiError(error);
  }
}
