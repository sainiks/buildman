import Ship from "@/components/Ship";
import { listConnections } from "@/lib/connections";
import { requireUidPage } from "@/lib/session";

export const metadata = { title: "New project" };

export default async function NewProject() {
  const uid = await requireUidPage();
  const connected = new Set((await listConnections(uid)).map((c) => c.provider));
  return (
    <Ship
      initial={{ github: connected.has("github"), vercel: connected.has("vercel"), supabase: connected.has("supabase") }}
    />
  );
}
