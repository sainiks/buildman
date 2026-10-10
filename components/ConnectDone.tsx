"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Landing page inside the connect pop-up. It tells the page that opened it (if the browser still
// links them) and closes itself. The opener also polls /api/connections, so a browser that severs
// the link between windows (some sign-in pages do) still works.
export default function ConnectDone({
  provider,
  name,
  error,
  next,
}: {
  provider: string;
  name: string;
  error: string | null;
  next: string | null;
}) {
  const [hasOpener, setHasOpener] = useState<boolean | null>(null);

  useEffect(() => {
    const opener = window.opener as Window | null;
    setHasOpener(Boolean(opener));
    try {
      opener?.postMessage({ type: "buildman:connect", provider, ok: !error, error }, window.location.origin);
    } catch {
      // The opener may be on another origin or gone; polling covers it.
    }
    if (error) return;
    const t = setTimeout(() => {
      // Vercel asks to be sent back to finish its install flow.
      if (next) window.location.replace(next);
      else window.close();
    }, 800);
    return () => clearTimeout(t);
  }, [provider, error, next]);

  return (
    <main className="login">
      <h1 className="h1">{error ? `Couldn't connect ${name}` : `${name} connected`}</h1>
      {error ? (
        <p className="notice bad" style={{ marginTop: 12 }}>{error}</p>
      ) : (
        <p className="sub" style={{ marginTop: 8 }}>
          {next ? "Finishing on Vercel…" : "You can close this window and go back to Buildman."}
        </p>
      )}
      <div className="row" style={{ marginTop: 20 }}>
        {hasOpener !== false ? (
          <button type="button" className="primary" onClick={() => window.close()}>Close window</button>
        ) : (
          <Link className="btn primary" href="/new">Back to Buildman</Link>
        )}
        {error && hasOpener !== false && <span className="small sub">Then press Connect again.</span>}
      </div>
    </main>
  );
}
