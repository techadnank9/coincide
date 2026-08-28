"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Chrome from "@/components/Chrome";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const fmtMin = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

interface Match {
  id: number;
  user_a: number;
  user_b: number;
  name_a: string;
  name_b: string;
  slot_start: string;
  slot_end: string;
  place_label: string | null;
  state: string;
}

function Me() {
  const as = Number(useSearchParams().get("as") ?? 1);
  const [me, setMe] = useState<{ name: string; windows: any[] } | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/person?user_id=${as}`).then((r) => r.json()).then(setMe);
    fetch(`/api/matches?user_id=${as}`).then((r) => r.json()).then((d) => setMatches(d.matches));
  }, [as]);
  useEffect(load, [load]);

  const accept = useCallback(
    async (id: number) => {
      setBusy(true);
      await fetch(`/api/match/${id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: as }),
      });
      setBusy(false);
      load();
    },
    [as, load],
  );

  return (
    <div className="page">
      <Chrome />
      <section className="meSection">
        <div className="sectionHead">
          <h1 className="display">{me ? me.name : "…"}</h1>
          <p className="sectionSub">Your hours, and the ones routed to you.</p>
        </div>

        {me && (
          <div className="meWindows">
            {me.windows.map((w: any) => (
              <span key={`${w.weekday}${w.start_min}${w.kind}`} className={`windowChip ${w.kind}`}>
                {DAYS[w.weekday]} {fmtMin(w.start_min)}–{fmtMin(w.end_min)} · {w.kind === "surplus" ? "an hour I have" : "an hour that's hard"}
              </span>
            ))}
          </div>
        )}

        <ul className="matchList">
          {matches.map((m) => {
            const other = m.user_a === as ? m.name_b : m.name_a;
            const canAccept = m.state === "proposed" && m.user_b === as;
            return (
              <li key={m.id} className={`matchCard ${m.state}`}>
                <div>
                  <strong>{other}</strong>
                  <span className="matchWhen">
                    {new Date(m.slot_start).toLocaleString("en-US", {
                      weekday: "long",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                    {m.place_label ? ` · ${m.place_label}` : ""}
                  </span>
                </div>
                {canAccept ? (
                  <button className="proposeBtn" disabled={busy} onClick={() => accept(m.id)}>
                    Accept this hour
                  </button>
                ) : (
                  <span className={`stateTag mono ${m.state}`}>{m.state}</span>
                )}
              </li>
            );
          })}
          {!matches.length && (
            <li className="sectionSub">Nothing routed to you yet. The coordinator sees your hours.</li>
          )}
        </ul>
      </section>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Me />
    </Suspense>
  );
}
