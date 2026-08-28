"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Chrome from "@/components/Chrome";

const avatar = (seed: string) =>
  `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(seed)}&backgroundColor=f6f3ec`;

const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

// One event, open to everyone: what, when, where, who's going, one button.
export default function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [ev, setEv] = useState<any>(null);
  const [me, setMe] = useState<{ id: number; name: string } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/activities/${id}`).then((r) => r.json()).then(setEv);
  }, [id]);
  useEffect(() => {
    load();
    const raw = localStorage.getItem("coincide_user");
    if (raw) setMe(JSON.parse(raw));
  }, [load]);

  const join = async () => {
    if (!me) return;
    setBusy(true);
    const res = await fetch(`/api/activities/${id}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: me.id }),
    });
    const d = await res.json();
    setBusy(false);
    setNote(res.ok ? "You're in. See you there." : d.error);
    load();
  };

  if (!ev) return <div className="page"><Chrome /><p className="loading mono">finding the plan…</p></div>;
  if (ev.error) return <div className="page"><Chrome /><p className="sectionSub">This plan isn’t on the board anymore.</p></div>;

  const going = me ? ev.members.some((m: any) => m.id === me.id) : false;
  const hosting = me ? ev.host.id === me.id : false;
  const full = ev.members.length >= ev.capacity;

  return (
    <div className="page">
      <Chrome />
      <section className="eventSection">
        <div className="mktWhen mono">{fmtWhen(ev.starts_at)} · {ev.duration_min} min</div>
        <h1 className="display eventTitle">{ev.title}</h1>
        <p className="sectionSub">{ev.place_label} · {ev.org}</p>

        <div className="eventHostRow">
          <Link href={`/people/${ev.host.id}`} className="eventHost">
            <img src={avatar(ev.host.name)} alt="" width={44} height={44} />
            <span>Hosted by <strong>{ev.host.name}</strong></span>
          </Link>
          {me && !hosting && (
            <Link href={`/chat/${ev.host.id}`} className="landBtnGhost eventMsg">
              Message {ev.host.name.split(" ")[0]}
            </Link>
          )}
        </div>

        <div className="eventGoing">
          <h2 className="display personSub">
            {ev.members.length ? `Going (${ev.members.length}/${ev.capacity})` : `Be the first (0/${ev.capacity})`}
          </h2>
          <div className="eventFaces">
            {ev.members.map((m: any) => (
              <Link key={m.id} href={`/people/${m.id}`} className="eventFace" title={m.name}>
                <img src={avatar(m.name)} alt={m.name} width={40} height={40} />
                <span>{m.name.split(" ")[0]}</span>
              </Link>
            ))}
          </div>
        </div>

        {note && <p className="mktNote">{note}</p>}

        {me ? (
          hosting ? (
            <p className="sectionSub">You’re hosting this one. Names appear here as people join.</p>
          ) : going ? (
            <span className="stateTag mono accepted">you're going</span>
          ) : (
            <button className="proposeBtn landBtn" disabled={busy || full} onClick={join}>
              {full ? "Full up" : "Count me in"}
            </button>
          )
        ) : (
          <Link href="/join" className="proposeBtn landBtn eventJoinLink">
            Join Coincide to take part
          </Link>
        )}
      </section>
    </div>
  );
}
