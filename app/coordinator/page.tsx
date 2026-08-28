"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Chrome, { QueryStats } from "@/components/Chrome";
import FreightMap, { MapCell } from "@/components/FreightMap";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const fmtMin = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

interface Drifter {
  user_id: number;
  name: string;
  seeded: boolean;
  deficit_slope: number;
  total_deficit: number;
  total_attended: number;
  monthly: { month: string; deficit: number }[];
  last_matched: string | null;
}
interface Candidate {
  candidate_id: number;
  name: string;
  temporal_overlap: number;
  reliability: number;
  attended: number;
  no_shows: number;
  proximity_decay: number;
  shape_fulfillment: number;
  score: number;
}
interface Window {
  weekday: number;
  start_min: number;
  end_min: number;
  kind: string;
  radius_m: number;
}

const ORG_ID = 1;

export default function Coordinator() {
  const [cells, setCells] = useState<MapCell[]>([]);
  const [drifters, setDrifters] = useState<Drifter[]>([]);
  const [stats, setStats] = useState<QueryStats | null>(null);
  const [selected, setSelected] = useState<Drifter | null>(null);
  const [windows, setWindows] = useState<Window[]>([]);
  const [slot, setSlot] = useState<Window | null>(null);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [candStats, setCandStats] = useState<QueryStats | null>(null);
  const [proposed, setProposed] = useState<{ id: number; name: string } | null>(null);
  const [rationale, setRationale] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/map?org_id=${ORG_ID}`)
      .then((r) => r.json())
      .then((d) => {
        setCells(d.cells);
        setStats({ rows_read: d.rows_read, elapsed_ms: d.elapsed_ms });
      });
    fetch(`/api/drifting?org_id=${ORG_ID}`)
      .then((r) => r.json())
      .then((d) => setDrifters(d.people));
  }, []);

  const pick = useCallback(async (p: Drifter) => {
    setSelected(p);
    setCandidates(null);
    setProposed(null);
    const d = await fetch(`/api/person?user_id=${p.user_id}`).then((r) => r.json());
    const defWins = d.windows.filter((w: Window) => w.kind === "deficit");
    setWindows(defWins);
    if (defWins.length) chooseSlot(p, defWins[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chooseSlot = useCallback(async (p: Drifter, w: Window) => {
    setSlot(w);
    setCandidates(null);
    const q = new URLSearchParams({
      org_id: String(ORG_ID),
      user_id: String(p.user_id),
      weekday: String(w.weekday),
      start_min: String(w.start_min),
      duration_min: String(w.end_min - w.start_min),
      radius_m: String(w.radius_m),
    });
    const d = await fetch(`/api/candidates?${q}`).then((r) => r.json());
    setCandidates(d.candidates);
    setCandStats({ rows_read: d.rows_read, elapsed_ms: d.elapsed_ms });
    setStats({ rows_read: d.rows_read, elapsed_ms: d.elapsed_ms });
  }, []);

  const propose = useCallback(
    async (c: Candidate) => {
      if (!selected || !slot) return;
      setBusy(true);
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_a: selected.user_id,
          user_b: c.candidate_id,
          org_id: ORG_ID,
          weekday: slot.weekday,
          start_min: slot.start_min,
          duration_min: slot.end_min - slot.start_min,
          place_label: "Japantown Peace Plaza café",
        }),
      }).then((r) => r.json());
      setBusy(false);
      if (res.match_id) {
        setProposed({ id: res.match_id, name: c.name });
        setRationale(null);
        const slotLabel = `${DAYS[slot.weekday]} ${fmtMin(slot.start_min)}–${fmtMin(slot.end_min)}`;
        fetch("/api/rationale", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ person: { name: selected.name }, candidate: c, slot: slotLabel }),
        })
          .then((r) => r.json())
          .then((d) => setRationale(d.rationale))
          .catch(() => {});
      }
    },
    [selected, slot],
  );

  const maxMonthly = useMemo(
    () => Math.max(1, ...drifters.flatMap((d) => d.monthly.map((m) => m.deficit))),
    [drifters],
  );

  return (
    <div className="page">
      <Chrome stats={stats} />

      <section className="mapSection">
        <div className="sectionHead">
          <h1 className="display">The freight map</h1>
          <p className="sectionSub">
            Declared hours across the whole org, 18 months of history, scanned live.
            Surplus is what people have. Deficit is what they can’t get through alone.
          </p>
        </div>
        {cells.length ? <FreightMap cells={cells} /> : <div className="loading mono">scanning…</div>}
      </section>

      <div className="columns">
        <section className="drift">
          <div className="sectionHead">
            <h2 className="display">Who’s drifting</h2>
            <p className="sectionSub">
              Deficit trajectory, month over month, unmatched three weeks or more.
              Attendance is a level — the trajectory is the signal.
            </p>
          </div>
          <ul className="driftList">
            {drifters.map((p) => (
              <li key={p.user_id}>
                <button
                  className={`driftRow${selected?.user_id === p.user_id ? " selected" : ""}`}
                  onClick={() => pick(p)}
                >
                  <span className="driftName">
                    {p.name}
                    {!p.seeded && <em className="realBadge">signed up live</em>}
                  </span>
                  <svg className="driftBars" viewBox="0 0 96 26" aria-hidden width={96} height={26}>
                    {p.monthly.map((m, i) => {
                      const h = Math.max(2, (m.deficit / maxMonthly) * 24);
                      return (
                        <rect
                          key={m.month}
                          x={i * (96 / p.monthly.length) + 1}
                          y={26 - h}
                          width={96 / p.monthly.length - 3}
                          height={h}
                          rx={1}
                          fill={i === p.monthly.length - 1 ? "var(--gap)" : "var(--deficit)"}
                          opacity={0.45 + (0.55 * i) / p.monthly.length}
                        />
                      );
                    })}
                  </svg>
                  <span className="driftMeta mono">
                    +{p.deficit_slope}/mo · attends {p.total_attended}
                  </span>
                </button>
              </li>
            ))}
            {!drifters.length && <li className="loading mono">ranking trajectories…</li>}
          </ul>
        </section>

        <section className="route">
          <div className="sectionHead">
            <h2 className="display">Route an hour</h2>
            {!selected && (
              <p className="sectionSub">
                Pick a person on the left. Their hardest hours appear here, with the
                people whose surplus already covers them.
              </p>
            )}
          </div>

          {selected && (
            <>
              <div className="routePerson">
                <strong>{selected.name}</strong>
                <span className="routeSlots">
                  {windows.map((w) => (
                    <button
                      key={`${w.weekday}-${w.start_min}`}
                      className={`slotChip${slot === w ? " active" : ""}`}
                      onClick={() => chooseSlot(selected, w)}
                    >
                      {DAYS[w.weekday]} {fmtMin(w.start_min)}–{fmtMin(w.end_min)}
                    </button>
                  ))}
                  {!windows.length && <span className="sectionSub">No declared deficit windows.</span>}
                </span>
              </div>

              {candidates === null && slot && <div className="loading mono">scanning cohorts…</div>}

              {candidates && (
                <div className="candList" style={{ animation: "riseIn 240ms cubic-bezier(0.16,1,0.3,1)" }}>
                  <div className="candHead mono">
                    <span>candidate</span>
                    <span title="Fraction of recent weeks their declared surplus covered this slot">overlap</span>
                    <span title="Attended ÷ (attended + no-shows), smoothed">shows up</span>
                    <span title="Exponential decay on typical meeting distance">near</span>
                    <span title="Org-wide success rate for meetings of this shape">shape</span>
                    <span>score</span>
                    <span />
                  </div>
                  {candidates.map((c, i) => (
                    <div className={`candRow${i === 0 ? " best" : ""}`} key={c.candidate_id}>
                      <span className="candName">
                        {c.name}
                        <em className="candRecord">
                          {c.attended} of {c.attended + c.no_shows} showed
                        </em>
                      </span>
                      <Meter v={c.temporal_overlap} />
                      <Meter v={c.reliability} />
                      <Meter v={c.proximity_decay} />
                      <Meter v={c.shape_fulfillment} />
                      <span className="candScore mono">{c.score.toFixed(3)}</span>
                      <button className="proposeBtn" disabled={busy || !!proposed} onClick={() => propose(c)}>
                        Propose
                      </button>
                    </div>
                  ))}
                  {!candidates.length && (
                    <p className="sectionSub">
                      Nobody’s declared surplus covers this hour yet — this is exactly the
                      gap the freight map shows.
                    </p>
                  )}
                  {candStats && (
                    <p className="candStats mono">
                      ranked over {candStats.rows_read.toLocaleString()} events in {candStats.elapsed_ms} ms
                    </p>
                  )}
                </div>
              )}

              {proposed && (
                <div className="proposedNote" style={{ animation: "routePulse 900ms ease-out" }}>
                  <strong>Hour routed.</strong> Match #{proposed.id} proposed to {proposed.name} —
                  written to Postgres in a transaction, event logged to ClickHouse. Switch to
                  their persona to accept.
                  <span className="rationale">
                    {rationale ?? <span className="mono">Claude is writing the why…</span>}
                  </span>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <footer className="foot">
        <span>Postgres holds who these people are. ClickHouse holds what’s happened to them. Neither does this alone.</span>
        <span className="mono">org #{ORG_ID} · 50M-event modeled history · live paths real</span>
      </footer>
    </div>
  );
}

function Meter({ v }: { v: number }) {
  return (
    <span className="meter" role="meter" aria-valuenow={v} aria-valuemin={0} aria-valuemax={1}>
      <i style={{ width: `${Math.round(v * 100)}%` }} />
      <b className="mono">{v.toFixed(2)}</b>
    </span>
  );
}
