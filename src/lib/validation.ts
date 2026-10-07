import { z } from "zod";
export const addressSchema = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
export const profileSchema = z.object({
  name: z.string().trim().min(1).max(40),
  building: z.string().trim().min(1).max(100),
  askAbout: z.string().trim().max(100),
  needsHelp: z.string().trim().max(140),
  available: z.boolean(),
  visible: z.boolean(),
});
export const questSchema = z.object({
  title: z.string().trim().min(4).max(64),
  ask: z.string().trim().min(10).max(280),
  minutes: z.number().int().min(1).max(30),
  meetingPoint: z.string().trim().min(3).max(100),
  kind: z.enum(["pitch", "debug", "learn", "demo"]),
});
