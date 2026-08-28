"use client";

import { use, useCallback, useEffect, useState } from "react";
import Chrome from "@/components/Chrome";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const fmtMin = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
const avatar = (seed: string) =>
  `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(seed)}&backgroundColor=f6f3ec`;

// A person's page: who they are, what they're into, and where they'll be next.
export default function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [p, setP] = useState<any>(null);
  const [me, setMe] = useState<{ id: number; name: string } | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/profile?user_id=${id}`).then((r) => r.json()).then(setP);
  }, [id]);
  useEffect(() => {
    load();
    const raw = localStorage.getItem("coincide_user");
    if (raw) setMe(JSON.parse(raw));
  }, [load]);

  const join = async (a: any) => {
    if (!me) {
      setNote("Join Coincide first, then you can jump into plans.");
      return;
    }
    const res = await fetch(`/api/activities/${a.id}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: me.id }),
    });
    const d = await res.json();
    setNote(res.ok ? `You're in for “${a.title}”.` : d.error);
    load();
  };

  if (!p) return <div className="page"><Chrome /><p className="loading mono">finding them…</p></div>;

  const total = p.attended + p.no_shows;
  return (
    <div className="page">
      <Chrome />
      <section className="personSection">
        <div className="personHead">
          <img src={avatar(p.name)} alt="" width={88} height={88} className="personAvatar" />
          <div>
            <h1 className="display">{p.name}</h1>
            {p.handle && <p className="personHandle mono">{p.handle}</p>}
            <p className="sectionSub">{p.org}</p>
          </div>
          {me && me.id !== p.id && (
            <a href={`/chat/${p.id}`} className="proposeBtn landBtn msgBtn">
              Message {p.name.split(" ")[0]}
            </a>
          )}
          {total > 0 && (
            <div className="personStats">
              <strong>{p.attended}</strong> of {total} plans showed up to
              {p.first_seen && (
                <span>
                  around since{" "}
                  {new Date(p.first_seen).toLocaleString("en-US", { month: "long", year: "numeric" })}
                </span>
              )}
            </div>
          )}
        </div>

        {p.bio && <p className="personBio">{p.bio}</p>}

        {p.interests?.length > 0 && (
          <div className="personInterests">
            {p.interests.map((t: string) => (
              <span key={t} className="windowChip">{t}</span>
            ))}
          </div>
        )}

        <h2 className="display personSub">Up next</h2>
        {note && <p className="mktNote">{note}</p>}
        <ul className="mktList">
          {p.upcoming.map((a: any) => (
            <li key={a.id} className="mktCard">
              <div className="mktWhen mono">{fmtWhen(a.starts_at)}</div>
              <h3><a href={`/events/${a.id}`} className="eventLink">{a.title}</a></h3>
              <p className="mktMeta">
                {a.place_label} · {a.hosting ? "hosting" : "going"} · {a.joined}/{a.capacity} in
              </p>
              {me && me.id !== p.id && a.joined < a.capacity && (
                <button className="proposeBtn" onClick={() => join(a)}>
                  Join {p.name.split(" ")[0]} there
                </button>
              )}
            </li>
          ))}
          {!p.upcoming.length && (
            <li className="sectionSub">Nothing on their calendar yet. Their hours are below.</li>
          )}
        </ul>

        {p.windows?.length > 0 && (
          <>
            <h2 className="display personSub">Their hours</h2>
            <div className="meWindows">
              {p.windows.map((w: any) => (
                <span key={`${w.weekday}${w.start_min}`} className={`windowChip ${w.kind}`}>
                  {DAYS[w.weekday]} {fmtMin(w.start_min)}–{fmtMin(w.end_min)} ·{" "}
                  {w.kind === "surplus" ? "free" : "wants company"}
                </span>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
