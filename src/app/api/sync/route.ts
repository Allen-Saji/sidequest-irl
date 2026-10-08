import { z } from "zod";
import { syncTransaction } from "@/lib/chain";
import { rateLimit } from "@/lib/db";
import { body, checkOrigin, requireSession, apiError } from "@/lib/auth";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const address = await requireSession();
    await rateLimit(`sync:${address}`, 20);
    const { digest } = z
      .object({ digest: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{40,50}$/) })
      .parse(await body(request));
    const quests = await syncTransaction(digest, address);
    return Response.json({ quests });
  } catch (error) {
    return apiError(error);
  }
}
