"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Chrome from "@/components/Chrome";

interface Activity {
  id: number;
  title: string;
  starts_at: string;
  duration_min: number;
  place_label: string;
  capacity: number;
  host_id: number;
  host_name: string;
  joined: number;
  members: string[];
}

const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

// The marketplace: what people at your center are planning, and a way to
// put your own hour on the board.
export default function Activities() {
  const [me, setMe] = useState<{ id: number; name: string } | null>(null);
  const [items, setItems] = useState<Activity[] | null>(null);
  const [posting, setPosting] = useState(false);
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState("");
  const [place, setPlace] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("coincide_user");
    if (raw) setMe(JSON.parse(raw));
  }, []);

  const load = useCallback(() => {
    fetch("/api/activities?org_id=1")
      .then((r) => r.json())
      .then((d) => setItems(d.activities));
  }, []);
  useEffect(load, [load]);

  const join = useCallback(
    async (a: Activity) => {
      if (!me) return;
      setBusy(true);
      const res = await fetch(`/api/activities/${a.id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: me.id }),
      });
      const d = await res.json();
      setBusy(false);
      setNote(res.ok ? `You're in for “${a.title}”. ${a.host_name} will see you there.` : d.error);
      load();
    },
    [me, load],
  );

  const post = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!me) return;
      setBusy(true);
      const res = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host_id: me.id,
          org_id: 1,
          title: title.trim(),
          starts_at: new Date(when).toISOString(),
          place_label: place.trim(),
        }),
      });
      setBusy(false);
      if (res.ok) {
        setTitle("");
        setWhen("");
        setPlace("");
        setPosting(false);
        setNote("It's on the board. You'll see people's names as they join.");
        load();
      }
    },
    [me, title, when, place, load],
  );

  return (
    <div className="page">
      <Chrome />
      <section className="mktSection">
        <div className="sectionHead mktHead">
          <div>
            <h1 className="display">
              {me ? `What's on, ${me.name.split(" ")[0]}` : "What's on nearby"}
            </h1>
            <p className="sectionSub">
              Real hours, real places, at your center. Join one, or put your own up.
            </p>
          </div>
          {me ? (
            <button className="proposeBtn" onClick={() => setPosting((p) => !p)}>
              {posting ? "Never mind" : "Post an activity"}
            </button>
          ) : (
            <Link href="/join" className="proposeBtn landBtn">
              Join to take part
            </Link>
          )}
        </div>

        {note && <p className="mktNote">{note}</p>}

        {posting && me && (
          <form className="joinForm mktForm" onSubmit={post}>
            <label>
              What are you up for?
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Morning walk around the plaza" required />
            </label>
            <label>
              When
              <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} required />
            </label>
            <label>
              Where
              <input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Japantown Peace Plaza" required />
            </label>
            <button className="proposeBtn" type="submit" disabled={busy}>
              Put it on the board
            </button>
          </form>
        )}

        <ul className="mktList">
          {items?.map((a) => {
            const mine = me && a.host_id === me.id;
            const joined = me ? a.members.includes(me.name) : false;
            const full = a.joined >= a.capacity;
            return (
              <li key={a.id} className="mktCard">
                <div className="mktWhen mono">{fmtWhen(a.starts_at)}</div>
                <h2><Link href={`/events/${a.id}`} className="eventLink">{a.title}</Link></h2>
                <p className="mktMeta">
                  {a.place_label} · hosted by {mine ? "you" : a.host_name}
                </p>
                <p className="mktMeta">
                  {a.joined === 0
                    ? "Be the first to join"
                    : `${a.joined} going${a.members.length ? ` (${a.members.slice(0, 3).join(", ")}${a.joined > 3 ? "…" : ""})` : ""}`}
                  {" · "}
                  {Math.max(0, a.capacity - a.joined)} spots left
                </p>
                {me && !mine && !joined && (
                  <button className="proposeBtn" disabled={busy || full} onClick={() => join(a)}>
                    {full ? "Full up" : "Count me in"}
                  </button>
                )}
                {joined && <span className="stateTag mono accepted">you're going</span>}
              </li>
            );
          })}
          {items && items.length === 0 && (
            <li className="sectionSub">
              Nothing on the board yet. {me ? "Yours could be first." : "Join and put something up."}
            </li>
          )}
          {!items && <li className="loading mono">loading the board…</li>}
        </ul>
      </section>
    </div>
  );
}
