"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          // Clipboard can be blocked; the text is visible next to the button.
        }
      }}
    >
      {done ? "Copied" : label}
    </button>
  );
}

export function RemoveProjectButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="stack" style={{ gap: 8 }}>
      <button
        type="button"
        className="danger"
        disabled={busy}
        onClick={async () => {
          if (!window.confirm(`Remove ${name} from Buildman? Its analytics are deleted. The GitHub repo, Vercel project and database are not touched.`)) return;
          setBusy(true);
          const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
          if (res.ok) {
            router.push("/");
            router.refresh();
          } else {
            setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Couldn't remove the project.");
            setBusy(false);
          }
        }}
      >
        Remove from Buildman
      </button>
      {error && <p className="small" style={{ color: "var(--bad)" }}>{error}</p>}
    </div>
  );
}

export function DisconnectButton({ provider, name }: { provider: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        if (!window.confirm(`Disconnect ${name}? Existing projects keep running, but Buildman can't create new ones there.`)) return;
        setBusy(true);
        await fetch("/api/connections", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider }),
        });
        router.refresh();
        setBusy(false);
      }}
    >
      Disconnect
    </button>
  );
}

export function ReinstallTagButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="stack" style={{ gap: 8 }}>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMsg(null);
          const res = await fetch(`/api/projects/${id}/snippet`, { method: "POST" });
          const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
          setMsg({ ok: res.ok, text: (res.ok ? data.message : data.error) ?? (res.ok ? "Done." : "Couldn't update the tag.") });
          setBusy(false);
          if (res.ok) router.refresh();
        }}
      >
        {busy ? "Updating repo…" : "Reinstall tracking in repo"}
      </button>
      {msg && <p className="small" style={{ color: msg.ok ? "var(--ok, inherit)" : "var(--bad)" }}>{msg.text}</p>}
    </div>
  );
}
