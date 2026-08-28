"use client";

import { useEffect, useRef, useState } from "react";
import Chrome from "@/components/Chrome";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

// Ask Coincide: chat with the community's data. Same brain LibreChat talks
// to, living right on the site for every visitor.
export default function Ask() {
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Tell me what kind of company you're after and I'll find people whose hours fit. Try: \"someone free Saturday mornings who likes chess\" or \"morning walkers near Japantown\".",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [msgs.length, busy]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content: text }];
    setMsgs(next);
    setDraft("");
    setBusy(true);
    try {
      const d = await fetch("/api/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.slice(-6) }),
      }).then((r) => r.json());
      const reply = d.choices?.[0]?.message?.content ?? "Something hiccuped. Try again?";
      setMsgs((m) => [...m, { role: "assistant", content: reply }]);
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: "Something hiccuped. Try again?" }]);
    }
    setBusy(false);
  };

  return (
    <div className="page">
      <Chrome />
      <section className="chatSection">
        <div className="sectionHead">
          <h1 className="display">Ask Coincide</h1>
          <p className="sectionSub">
            Describe the company you’re after. Answers come from real people’s
            real hours, never invented.
          </p>
        </div>
        <div className="thread askThread">
          {msgs.map((m, i) => (
            <div
              key={i}
              className={`bubble ${m.role === "user" ? "bubbleMe" : "bubbleThem"} askBubble`}
              dangerouslySetInnerHTML={{
                __html: m.content
                  .replace(/&/g, "&amp;").replace(/</g, "&lt;")
                  .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
                  .replace(/\[(.+?)\]\((https?:[^)]+)\)/g, '<a href="$2">$1</a>')
                  .replace(/(https?:\/\/trycoincide\.vercel\.app\/people\/\d+)/g, '<a href="$1">$1</a>')
                  .replace(/\n/g, "<br/>"),
              }}
            />
          ))}
          {busy && <div className="bubble bubbleThem askBubble mono">looking through the hours…</div>}
          <div ref={endRef} />
        </div>
        <form className="threadForm" onSubmit={send}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Someone free Tuesday evenings who likes…"
            maxLength={500}
          />
          <button className="proposeBtn" type="submit" disabled={busy || !draft.trim()}>
            Ask
          </button>
        </form>
      </section>
    </div>
  );
}
