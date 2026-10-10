import { DisconnectButton } from "@/components/Actions";
import { listConnections } from "@/lib/connections";
import { timeAgo } from "@/lib/format";
import { providerList } from "@/lib/providers";
import { requireUserPage } from "@/lib/session";

export const metadata = { title: "Connections" };

export default async function Connections({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string; next?: string }>;
}) {
  const user = await requireUserPage();
  const q = await searchParams;
  const connections = await listConnections(user.id);
  const just = providerList.find((p) => p.id === q.connected);
  const next = q.next && /^https:\/\/([a-z0-9-]+\.)*vercel\.com\//i.test(q.next) ? q.next : null;

  return (
    <>
      <div className="head">
        <div>
          <h1 className="h1">Connections</h1>
          <p className="sub">Connect each service once. Buildman uses your own accounts, so everything it creates belongs to you.</p>
        </div>
      </div>

      <div className="stack">
        {just && (
          <p className="notice good">
            {just.name} is connected.{" "}
            {next && <a href={next}>Finish the install on Vercel</a>}
          </p>
        )}
        {q.error && <p className="notice bad">{q.error}</p>}

        {providerList.map((p) => {
          const c = connections.find((x) => x.provider === p.id);
          return (
            <section key={p.id} className="card plug">
              <div>
                <div className="name">{p.name}</div>
                <p className="sub small">{p.blurb}</p>
                <p className="small" style={{ marginTop: 6 }}>
                  {c ? (
                    <>Connected as <b>{c.accountLabel}</b> · {timeAgo(c.connectedAt)}</>
                  ) : p.configured() ? (
                    <span className="sub">Not connected</span>
                  ) : (
                    <span className="sub">Not set up on this server yet. The server admin needs to add {p.envVars.join(", ")}.</span>
                  )}
                </p>
              </div>
              <div className="row">
                {p.id === "github" ? (
                  <span className="small sub">You sign in with it</span>
                ) : (
                  <>
                    {c && <DisconnectButton provider={p.id} name={p.name} />}
                    {p.configured() && (
                      <a className={c ? "btn" : "btn primary"} href={`/api/oauth/${p.id}/start`}>
                        {c ? "Reconnect" : `Connect ${p.name}`}
                      </a>
                    )}
                  </>
                )}
              </div>
            </section>
          );
        })}

        <section className="card plug dim">
          <div>
            <div className="name">More connections</div>
            <p className="sub small">Other hosts and services will show up here as they are added.</p>
          </div>
        </section>
      </div>
    </>
  );
}
