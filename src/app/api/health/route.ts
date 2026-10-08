import { storageHealth } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await storageHealth();
    return Response.json({
      ok: true,
      storage: "supabase",
      network: "sui-testnet",
    });
  } catch {
    return Response.json(
      { ok: false, error: "Storage is unavailable." },
      { status: 503 },
    );
  }
}
