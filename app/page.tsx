"use client";

import Link from "next/link";
import Chrome from "@/components/Chrome";

// Landing, Persuade mode. Consumer-facing: the thesis carries the page,
// nothing about the infrastructure underneath.
export default function Landing() {
  return (
    <div className="page">
      <Chrome tagline={false} />

      <section className="landHero">
        <h1 className="display">
          Meet people when
          <br />
          your hours coincide.
        </h1>
        <p className="landLede">
          Some hours are easy to give. A retired neighbor’s open Tuesday
          afternoon. A student’s free Saturday morning. And some hours are
          hard to get through alone. Coincide brings the two together: you
          say which hours you have and which ones are tough, and your
          community’s coordinator turns them into a coffee, a walk, a game
          of cards.
        </p>
        <div className="landCtas">
          <Link href="/join" className="proposeBtn landBtn">
            Join now
          </Link>
          <Link href="/coordinator" className="landBtnGhost">
            For coordinators
          </Link>
        </div>
      </section>

      <section className="landHow">
        <div className="landStep">
          <h2 className="display">Say when, not who</h2>
          <p>
            An hour you have. An hour that’s hard alone. That’s your whole
            profile. Nobody is shopping for a friend here, and nobody has to
            perform one.
          </p>
        </div>
        <div className="landStep">
          <h2 className="display">Someone keeps an eye out</h2>
          <p>
            It’s easy to look fine and still be sinking. Coincide helps your
            coordinator notice when the hard hours start piling up, long
            before anyone stops coming to Thursday lunch.
          </p>
        </div>
        <div className="landStep">
          <h2 className="display">One yes at a time</h2>
          <p>
            No algorithmic introductions. A coordinator at your own center
            proposes one hour with one person. Both of you say yes, or
            nothing happens at all.
          </p>
        </div>
      </section>

      <section className="landSafety">
        <h2 className="display">Built to be declined</h2>
        <p>
          Everything stays inside your own center. First meetings happen in
          public places. Nobody gets punished for missing an hour, and you can
          take your hours back whenever you want. The whole point is to make
          one good hour easy, not to make anyone feel watched.
        </p>
      </section>

      <footer className="foot">
        <span>Made for the people who hold communities together.</span>
        <span>Coincide</span>
      </footer>
    </div>
  );
}
