import { connection } from "next/server";
import type { Branding } from "@/domain/merchant/branding";
import { getDatabase } from "@/server/db/client";
import { SqliteBrandingRepository } from "@/server/repositories/branding-repository";

/** Request-time branding for Server Components, so a merchant's change shows on the next request. */
export async function getBranding(): Promise<Branding> {
  await connection();
  return new SqliteBrandingRepository(getDatabase()).get();
}
