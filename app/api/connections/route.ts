import { deleteConnection, listConnections } from "@/lib/connections";
import { HttpError, handle } from "@/lib/env";
import { getProvider, providerList } from "@/lib/providers";
import { requireUserId } from "@/lib/session";

export const GET = handle(async () => {
  const userId = await requireUserId();
  const connected = await listConnections(userId);
  return {
    providers: providerList.map((p) => ({
      id: p.id,
      name: p.name,
      configured: p.configured(),
      connection: connected.find((c) => c.provider === p.id) ?? null,
    })),
  };
});

export const DELETE = handle(async (req) => {
  const userId = await requireUserId();
  const { provider } = (await req.json().catch(() => ({}))) as { provider?: string };
  const p = provider ? getProvider(provider) : null;
  if (!p) throw new HttpError(400, "Unknown provider.");
  if (p.id === "github") throw new HttpError(400, "GitHub is how you sign in, so it can't be disconnected. Sign out instead.");
  await deleteConnection(userId, p.id);
  return { ok: true };
});
