"use client";

import Link from "next/link";
import Chrome from "@/components/Chrome";
import HeroScene from "@/components/HeroScene";
import Reveal from "@/components/Reveal";

// Landing, Persuade mode. Consumer-facing: warm, illustrated, animated.
// Nothing about the infrastructure underneath.
export default function Landing() {
  return (
    <div className="page">
      <Chrome tagline={false} />

      <section className="landHero">
        <div className="landHeroText">
          <h1 className="display">
            Meet people when
            <br />
            your hours coincide.
          </h1>
          <p className="landLede">
            Free on Tuesday afternoons? Somebody at your center is too, and
            they’d rather not spend it alone either. Put a small plan on the
            board, a walk, a coffee, a game of cards, or join one that already
            fits your week. That’s the whole app.
          </p>
          <div className="landCtas">
            <Link href="/join" className="proposeBtn landBtn">
              Join now
            </Link>
            <Link href="/activities" className="landBtnGhost">
              See what’s on
            </Link>
          </div>
        </div>
        <HeroScene />
      </section>

      <section className="landHow">
        <Reveal>
          <div className="landStep">
            <h2 className="display">Post a plan, not a profile</h2>
            <p>
              What, when, where. “Morning walk, Saturday 10, the plaza
              fountain.” No bios, no photos to pick, nothing to perform.
              Your name and your plan are the whole thing.
            </p>
          </div>
        </Reveal>
        <Reveal delay={120}>
          <div className="landStep">
            <h2 className="display">Somebody notices</h2>
            <p>
              It’s easy to look fine and still be sinking. The people who run
              your center can see when someone’s weeks are getting emptier,
              and quietly make sure an invitation comes their way.
            </p>
          </div>
        </Reveal>
        <Reveal delay={240}>
          <div className="landStep">
            <h2 className="display">One yes at a time</h2>
            <p>
              See who’s already going, tap “count me in,” and that’s it.
              Nobody gets matched to anybody. You pick the plan, they see
              your name, everyone knew what they said yes to.
            </p>
          </div>
        </Reveal>
      </section>

      <section className="landConvo">
        <Reveal>
          <h2 className="display">How an hour finds you</h2>
        </Reveal>
        <div className="convo">
          <Reveal delay={80}>
            <div className="bubble bubbleThem">
              <b>Denise, coordinator</b>
              Hi Ray! Margaret from the Thursday lunch group has a hard time
              with Monday evenings. You said yours are free. Coffee at the
              plaza café next Monday, 7 pm?
            </div>
          </Reveal>
          <Reveal delay={200}>
            <div className="bubble bubbleMe">Happy to. Count me in.</div>
          </Reveal>
          <Reveal delay={320}>
            <div className="bubble bubbleThem">
              <b>Denise, coordinator</b>
              Done. Margaret says she’ll bring the crossword. It’s a six
              minute walk for you both.
            </div>
          </Reveal>
        </div>
      </section>

      <section className="landSafety">
        <Reveal>
          <h2 className="display">Built to be declined</h2>
          <p>
            Everything stays inside your own center. First meetings happen in
            public places. Nobody gets punished for missing an hour, and you
            can take your hours back whenever you want. The whole point is to
            make one good hour easy, not to make anyone feel watched.
          </p>
        </Reveal>
      </section>

      <section className="landEnd">
        <Reveal>
          <h2 className="display">Got an hour?</h2>
          <p>Someone near you is free then too. Let your hours coincide.</p>
          <Link href="/join" className="proposeBtn landBtn">
            Join now
          </Link>
        </Reveal>
      </section>

      <footer className="foot">
        <span>Made for the people who hold communities together.</span>
        <span>Coincide</span>
      </footer>
    </div>
  );
}
