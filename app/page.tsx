"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Chrome from "@/components/Chrome";

// Landing — Persuade mode. The thesis carries the page; the live scan
// numbers are the proof. No stock imagery, no category clichés.
export default function Landing() {
  const [stats, setStats] = useState<{ rows_read: number; elapsed_ms: number } | null>(null);

  useEffect(() => {
    fetch("/api/map?org_id=1")
      .then((r) => r.json())
      .then((d) => setStats({ rows_read: d.rows_read, elapsed_ms: d.elapsed_ms }))
      .catch(() => {});
  }, []);

  return (
    <div className="page">
      <Chrome tagline={false} />

      <section className="landHero">
        <h1 className="display">
          We are not matching people.
          <br />
          We are routing hours.
        </h1>
        <p className="landLede">
          Every loneliness app matches on identity — interests, demographics,
          personality — then leaves the scheduling to you. The interests were
          never the bottleneck. The hours were. Coincide starts from the
          hour: the Tuesday afternoon one person can’t fill, and the Tuesday
          afternoon another can’t get through.
        </p>
        <div className="landCtas">
          <Link href="/coordinator" className="proposeBtn landBtn">
            See the freight map
          </Link>
          <Link href="/join" className="landBtnGhost">
            Declare an hour
          </Link>
        </div>
        {stats && (
          <p className="landProof mono" aria-live="polite">
            {stats.rows_read.toLocaleString()} hour-events scanned live in{" "}
            {stats.elapsed_ms} ms to draw one org’s map
          </p>
        )}
      </section>

      <section className="landHow">
        <div className="landStep">
          <h2 className="display">Declare time, not identity</h2>
          <p>
            An hour you have. An hour that’s hard alone. That’s the entire
            profile — nobody is shopping for a friend, and nobody has to
            perform one.
          </p>
        </div>
        <div className="landStep">
          <h2 className="display">The trajectory is the signal</h2>
          <p>
            Attendance sheets miss the person who still shows up while their
            hard hours climb month over month. Coincide ranks people by that
            slope — across eighteen months of history, in the time a page
            takes to load.
          </p>
        </div>
        <div className="landStep">
          <h2 className="display">A person routes the hour</h2>
          <p>
            No algorithmic introductions. A coordinator at your own center
            reads the map, sees why each candidate scores what they score,
            and proposes one hour. Both sides accept, or nothing happens.
          </p>
        </div>
      </section>

      <section className="landSafety">
        <h2 className="display">Built to be declined</h2>
        <p>
          Matches stay inside a verified organization. First meetings default
          to public places. Consent is one revocable row you own. A no-show is
          never punished — it just teaches the routing. The system’s job is to
          make one good hour easy, not to make anyone feel watched.
        </p>
      </section>

      <footer className="foot">
        <span>
          Postgres holds who people are. ClickHouse holds what’s happened to
          them. Neither does this alone.
        </span>
        <span className="mono">Coincide — routing hours</span>
      </footer>
    </div>
  );
}
