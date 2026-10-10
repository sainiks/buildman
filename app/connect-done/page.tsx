import ConnectDone from "@/components/ConnectDone";
import { getProvider } from "@/lib/providers";

export const dynamic = "force-dynamic";
export const metadata = { title: "Connecting" };

export default async function ConnectDonePage({
  searchParams,
}: {
  searchParams: Promise<{ provider?: string; connected?: string; error?: string; next?: string }>;
}) {
  const q = await searchParams;
  const provider = getProvider(q.provider ?? q.connected ?? "");
  // Only ever pass on a Vercel URL (it finishes Vercel's install flow).
  const next = q.next && /^https:\/\/([a-z0-9-]+\.)*vercel\.com\//i.test(q.next) ? q.next : null;
  return (
    <ConnectDone
      provider={provider?.id ?? ""}
      name={provider?.name ?? "Service"}
      error={q.error ? q.error.slice(0, 300) : null}
      next={next}
    />
  );
}
