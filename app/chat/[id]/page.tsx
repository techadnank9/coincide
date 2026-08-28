"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Chrome from "@/components/Chrome";

const avatar = (seed: string) =>
  `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(seed)}&backgroundColor=f6f3ec`;

// One thread. Polls every few seconds; no sockets needed at this scale.
export default function Thread({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const otherId = Number(id);
  const [me, setMe] = useState<{ id: number; name: string } | null>(null);
  const [other, setOther] = useState<any>(null);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const raw = localStorage.getItem("coincide_user");
    if (raw) setMe(JSON.parse(raw));
    fetch(`/api/person?user_id=${otherId}`).then((r) => r.json()).then(setOther);
  }, [otherId]);

  const load = useCallback(async () => {
    if (!me) return;
    const d = await fetch(`/api/messages?a=${me.id}&b=${otherId}`).then((r) => r.json());
    setMsgs(d.messages);
  }, [me, otherId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [msgs.length]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!me || !draft.trim()) return;
    setBusy(true);
    await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from_id: me.id, to_id: otherId, body: draft }),
    });
    setDraft("");
    setBusy(false);
    load();
  };

  return (
    <div className="page">
      <Chrome />
      <section className="chatSection">
        <div className="threadHead">
          <Link href="/chat" className="chrome-persona">← Chats</Link>
          {other && (
            <Link href={`/people/${otherId}`} className="threadWho">
              <img src={avatar(other.name)} alt="" width={40} height={40} />
              <strong>{other.name}</strong>
            </Link>
          )}
        </div>

        {!me ? (
          <p className="sectionSub">
            <Link href="/join">Join Coincide</Link> to send a message.
          </p>
        ) : (
          <>
            <div className="thread">
              {msgs.map((m) => (
                <div key={m.id} className={`bubble ${m.from_id === me.id ? "bubbleMe" : "bubbleThem"}`}>
                  {m.body}
                </div>
              ))}
              {!msgs.length && (
                <p className="sectionSub">
                  Say hello. Suggest an hour that works for you both — that’s how everything here starts.
                </p>
              )}
              <div ref={endRef} />
            </div>
            <form className="threadForm" onSubmit={send}>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={other ? `Message ${other.name.split(" ")[0]}…` : "Message…"}
                maxLength={2000}
              />
              <button className="proposeBtn" type="submit" disabled={busy || !draft.trim()}>
                Send
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
