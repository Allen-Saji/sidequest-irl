import { profileSchema } from "@/lib/validation";
import { getProfile, rateLimit, saveProfile } from "@/lib/db";
import {
  body,
  checkOrigin,
  requireSession,
  sessionAddress,
  apiError,
} from "@/lib/auth";
export async function GET() {
  const address = await sessionAddress();
  return Response.json({
    address,
    profile: address ? await getProfile(address) : null,
  });
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const address = await requireSession();
    await rateLimit(`profile:${address}`);
    const data = profileSchema.parse(await body(request));
    const previous = await getProfile(address);
    const profile = {
      address,
      name: data.name,
      building: data.building,
      askAbout: data.askAbout,
      needsHelp: data.needsHelp,
      availableUntil: data.available ? Date.now() + 20 * 60_000 : 0,
      visible: data.visible,
      demo: previous?.demo ?? false,
      color: previous?.color ?? parseInt(address.slice(-2), 16) % 4,
    };
    await saveProfile(profile);
    return Response.json({ profile });
  } catch (error) {
    return apiError(error);
  }
}
