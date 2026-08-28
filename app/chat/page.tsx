"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Chrome from "@/components/Chrome";

const avatar = (seed: string) =>
  `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(seed)}&backgroundColor=f6f3ec`;

// Inbox: your conversations, newest first.
export default function Inbox() {
  const [me, setMe] = useState<{ id: number; name: string } | null>(null);
  const [threads, setThreads] = useState<any[] | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("coincide_user");
    if (!raw) return;
    const u = JSON.parse(raw);
    setMe(u);
    fetch(`/api/inbox?user_id=${u.id}`)
      .then((r) => r.json())
      .then((d) => setThreads(d.threads));
  }, []);

  return (
    <div className="page">
      <Chrome />
      <section className="chatSection">
        <div className="sectionHead">
          <h1 className="display">Chats</h1>
          <p className="sectionSub">
            {me ? "Conversations with people whose hours met yours." : "Join Coincide to message people."}
          </p>
        </div>
        {!me && <Link href="/join" className="proposeBtn landBtn">Join now</Link>}
        <ul className="inboxList">
          {threads?.map((t) => (
            <li key={t.other_id}>
              <Link href={`/chat/${t.other_id}`} className="inboxRow">
                <img src={avatar(t.other_name)} alt="" width={44} height={44} />
                <span className="inboxWho">
                  <strong>{t.other_name}</strong>
                  <em>{t.mine ? "You: " : ""}{t.last}</em>
                </span>
                <span className="inboxWhen mono">
                  {new Date(t.at).toLocaleString("en-US", { month: "short", day: "numeric" })}
                </span>
              </Link>
            </li>
          ))}
          {me && threads && !threads.length && (
            <li className="sectionSub">
              No conversations yet. Find someone on the <Link href="/map">map</Link> and say hello
              from their profile.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
