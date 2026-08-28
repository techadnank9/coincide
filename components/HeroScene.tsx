"use client";

// Two people, each with hours floating around them. One side's hours are
// free, the other side's are heavy. In the middle, two chips align: the
// coincidence the product is named for. Pure geometry, CSS-animated.
export default function HeroScene() {
  return (
    <div className="scene" aria-hidden>
      {/* left person: has hours to give */}
      <div className="figure figLeft">
        <svg viewBox="0 0 140 200" width="150" height="214">
          <ellipse cx="70" cy="192" rx="52" ry="7" fill="var(--line)" />
          <circle cx="70" cy="44" r="30" fill="var(--surplus)" />
          <rect x="33" y="84" width="74" height="102" rx="34" fill="var(--surplus-deep)" />
        </svg>
        <span className="chip float1" style={{ top: "-6%", left: "-42%" }}>Tue 2–4 pm</span>
        <span className="chip float2" style={{ top: "30%", left: "-58%" }}>Sat morning</span>
        <span className="chip float3" style={{ top: "62%", left: "-38%" }}>Thu lunch</span>
      </div>

      {/* the coincidence: two hours meeting in the middle */}
      <div className="meet">
        <span className="chip meetA">Tue 2–4 pm</span>
        <span className="chip meetB">Tue 2–4 pm</span>
        <svg className="meetRing" viewBox="0 0 120 120" width="120" height="120">
          <circle cx="60" cy="60" r="54" fill="none" stroke="var(--gap)" strokeWidth="2.5" strokeDasharray="6 8" strokeLinecap="round" />
        </svg>
      </div>

      {/* right person: hours that are hard, tangled overhead */}
      <div className="figure figRight">
        <svg viewBox="0 0 140 200" width="150" height="214">
          <ellipse cx="70" cy="192" rx="52" ry="7" fill="var(--line)" />
          <path
            className="tangle"
            d="M26 30 C 48 2, 84 4, 98 22 S 138 34, 116 50 S 70 38, 52 50 S 8 50, 26 30 Z"
            fill="none"
            stroke="var(--deficit)"
            strokeWidth="3.5"
            strokeLinecap="round"
            opacity="0.85"
          />
          <circle cx="70" cy="82" r="30" fill="var(--deficit)" />
          <rect x="33" y="122" width="74" height="64" rx="32" fill="var(--deficit-deep)" />
        </svg>
        <span className="chip chipHard float2" style={{ top: "8%", right: "-50%" }}>Tue afternoons</span>
        <span className="chip chipHard float1" style={{ top: "48%", right: "-56%" }}>Sunday evenings</span>
      </div>
    </div>
  );
}
