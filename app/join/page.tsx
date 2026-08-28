"use client";

import { useState } from "react";
import Chrome from "@/components/Chrome";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Public intake. A person signing up here flows through exactly the same code
// as the seeded population — that is the honesty line in the demo.
export default function Join() {
  const [name, setName] = useState("");
  const [weekday, setWeekday] = useState(2);
  const [start, setStart] = useState(600);
  const [kind, setKind] = useState<"surplus" | "deficit">("surplus");
  const [done, setDone] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const res = await fetch("/api/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        display_name: name.trim(),
        org_id: 1,
        weekday,
        start_min: start,
        end_min: start + 120,
        kind,
      }),
    }).then((r) => r.json());
    setBusy(false);
    setDone(res.user_id);
  };

  return (
    <div className="page">
      <Chrome />
      <section className="joinSection">
        <div className="joinHero" aria-label="Hero media slot">
          {/* HERO MEDIA SLOT — shoot on the day: empty chairs, a full room, a
              bench in Japantown. Drop the photo at /public/hero.jpg and swap
              this placeholder for an <img>. No stock photography. */}
          <span className="mono">photo slot</span>
        </div>

        <div className="joinCopy">
          <h1 className="display">Give an hour.<br />Name a hard one.</h1>
          <p>
            You don’t have to be looking for a friend. A Tuesday afternoon
            you’d like filled, or one that’s hard to get through, is all we
            need to know. Your center’s coordinator takes it from there.
          </p>
        </div>

        {done === null ? (
          <form className="joinForm" onSubmit={submit}>
            <label>
              Your name
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Eleanor Ames" required />
            </label>
            <label>
              Day
              <select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
                {DAYS.map((d, i) => (
                  <option key={d} value={i}>{d}</option>
                ))}
              </select>
            </label>
            <label>
              Starting at
              <select value={start} onChange={(e) => setStart(Number(e.target.value))}>
                {Array.from({ length: 32 }, (_, i) => 360 + i * 30).map((m) => (
                  <option key={m} value={m}>
                    {String(Math.floor(m / 60)).padStart(2, "0")}:{String(m % 60).padStart(2, "0")}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="kindPick">
              <legend>This hour is…</legend>
              <label className={kind === "surplus" ? "picked" : ""}>
                <input type="radio" name="kind" checked={kind === "surplus"} onChange={() => setKind("surplus")} />
                one I have to give
              </label>
              <label className={kind === "deficit" ? "picked" : ""}>
                <input type="radio" name="kind" checked={kind === "deficit"} onChange={() => setKind("deficit")} />
                one that’s hard alone
              </label>
            </fieldset>
            <button className="proposeBtn" type="submit" disabled={busy}>
              Declare the hour
            </button>
            <p className="joinFine">
              Only people at your own center can see this. First meetings happen
              in public places, and you can take your hours back any time.
            </p>
          </form>
        ) : (
          <div className="proposedNote" style={{ animation: "routePulse 900ms ease-out" }}>
            <strong>You’re in.</strong> Your hour is on your coordinator’s map now.
            When it lines up with someone else’s, you’ll hear from them.
          </div>
        )}
      </section>
    </div>
  );
}
