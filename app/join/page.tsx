"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Chrome from "@/components/Chrome";

// Signup, deliberately light: a name and an email. If the email is known,
// it signs you back in. The profile lives in localStorage after that.
export default function Join() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), email: email.trim(), org_id: 1 }),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(d.error ?? "That didn't work. Try again?");
      return;
    }
    localStorage.setItem("coincide_user", JSON.stringify({ id: d.user_id, name: d.name }));
    router.push("/activities");
  };

  return (
    <div className="page">
      <Chrome />
      <section className="joinSection">
        <div className="joinHero" aria-label="Photo slot">
          <span className="mono">photo slot</span>
        </div>

        <div className="joinCopy">
          <h1 className="display">Got an hour?<br />Someone nearby does too.</h1>
          <p>
            Put your name in, see what people at your center are planning, and
            post something of your own. A walk, a coffee, a game of cards.
            Whoever's hours line up with yours will find it.
          </p>
        </div>

        <form className="joinForm" onSubmit={submit}>
          <label>
            Your name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Eleanor Ames" required />
          </label>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="eleanor@example.com"
              required
            />
          </label>
          <button className="proposeBtn" type="submit" disabled={busy}>
            {busy ? "One moment…" : "Join your center"}
          </button>
          {error && <p className="joinFine" role="alert">{error}</p>}
          <p className="joinFine">
            Only people at your own center can see you. First meetings happen in
            public places, and you can leave any time. No passwords, no spam,
            just your name on the board.
          </p>
        </form>
      </section>
    </div>
  );
}
