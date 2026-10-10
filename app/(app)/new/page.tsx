import Ship from "@/components/Ship";
import { listConnections } from "@/lib/connections";
import { requireUserPage } from "@/lib/session";

export const metadata = { title: "New project" };

export default async function NewProject() {
  const user = await requireUserPage();
  const connected = new Set((await listConnections(user.id)).map((c) => c.provider));
  return (
    <Ship
      initial={{ github: connected.has("github"), vercel: connected.has("vercel"), supabase: connected.has("supabase") }}
    />
  );
}
