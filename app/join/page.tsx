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
          <span className="mono">hero media — shot on site</span>
        </div>

        <div className="joinCopy">
          <h1 className="display">Give an hour.<br />Name a hard one.</h1>
          <p>
            You don’t have to be looking for a friend. A Tuesday afternoon you’d
            like filled, or one you can’t get through — that’s all the system
            needs. Your center’s coordinator routes the rest.
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
              Within your own center only. First meetings in public places. You can
              revoke this any time — consent lives in one row and it’s yours.
            </p>
          </form>
        ) : (
          <div className="proposedNote" style={{ animation: "routePulse 900ms ease-out" }}>
            <strong>You’re in.</strong> Member #{done}, live in the same system as
            everyone on the coordinator’s map — look for the “signed up live” mark.
          </div>
        )}
      </section>
    </div>
  );
}
