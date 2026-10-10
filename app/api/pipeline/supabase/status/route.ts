import { credentials } from "@/lib/connections";
import { HttpError, handle } from "@/lib/env";
import { requireUserId } from "@/lib/session";
import { supabaseStatus } from "@/lib/supabase";

export const maxDuration = 30;

export const GET = handle(async (req) => {
  const userId = await requireUserId();
  const ref = new URL(req.url).searchParams.get("ref");
  if (!ref || !/^[a-z0-9]{10,40}$/.test(ref)) throw new HttpError(400, "ref is required.");
  const { token } = await credentials(userId, "supabase");
  return { status: await supabaseStatus(token, ref) };
});
