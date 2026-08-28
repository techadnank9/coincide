"use client";

export interface MapCell {
  weekday: number;
  band: number;
  surplus: number;
  deficit: number;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const BAND_FROM = 12; // 06:00
const BAND_TO = 46; // 23:00
const HOUR_TICKS = [12, 20, 28, 36, 44]; // 06 10 14 18 22

function fmtBand(band: number) {
  const h = Math.floor((band * 30) / 60);
  const m = (band * 30) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Surplus in ochre, deficit in ink blue. The gap — deficit hours with no
// surplus there to meet them — burns through in a third color. That gap is
// the product; the eye should land on it first.
export default function FreightMap({ cells }: { cells: MapCell[] }) {
  const byKey = new Map(cells.map((c) => [`${c.weekday}:${c.band}`, c]));
  // Each kind is normalized against its own peak after subtracting its noise
  // floor (the org-wide background of scattered declarations). What survives
  // is structure: where surplus lives, where deficit lives, where they miss.
  const median = (xs: number[]) => {
    const v = [...xs].sort((a, b) => a - b);
    return v.length ? v[Math.floor(v.length / 2)] : 0;
  };
  const medS = median(cells.map((c) => c.surplus));
  const medD = median(cells.map((c) => c.deficit));
  const maxS = Math.max(1, ...cells.map((c) => c.surplus - medS));
  const maxD = Math.max(1, ...cells.map((c) => c.deficit - medD));
  const scaleS = (v: number) => Math.sqrt(Math.max(0, v - medS) / maxS);
  const scaleD = (v: number) => Math.sqrt(Math.max(0, v - medD) / maxD);

  return (
    <div className="fmap">
      <div className="fmap-grid" role="img" aria-label="Freight map of declared surplus and deficit hours by weekday and half-hour band">
        {[1, 2, 3, 4, 5, 6, 0].map((day) => (
          <div className="fmap-row" key={day}>
            <span className="fmap-day">{DAYS[day]}</span>
            {Array.from({ length: BAND_TO - BAND_FROM + 1 }, (_, i) => {
              const band = BAND_FROM + i;
              const c = byKey.get(`${day}:${band}`) ?? {
                surplus: 0,
                deficit: 0,
              };
              const s = scaleS(c.surplus);
              const d = scaleD(c.deficit);
              // the gap: real deficit structure with no surplus structure to meet it
              const unmet = d > 0.48 && s < 0.06;
              let bg = "transparent";
              if (unmet) bg = `color-mix(in oklab, var(--gap) ${Math.round(30 + d * 65)}%, var(--card))`;
              else if (d > s && d > 0.14) bg = `color-mix(in oklab, var(--deficit) ${Math.round(d * 80)}%, var(--card))`;
              else if (s > 0.12) bg = `color-mix(in oklab, var(--surplus) ${Math.round(s * 85)}%, var(--card))`;
              return (
                <span
                  key={band}
                  className="fmap-cell"
                  style={{ background: bg }}
                  title={`${DAYS[day]} ${fmtBand(band)} — surplus ${c.surplus.toLocaleString()}, deficit ${c.deficit.toLocaleString()}`}
                />
              );
            })}
          </div>
        ))}
        <div className="fmap-row fmap-ticks">
          <span className="fmap-day" />
          {Array.from({ length: BAND_TO - BAND_FROM + 1 }, (_, i) => {
            const band = BAND_FROM + i;
            return (
              <span key={band} className="fmap-tick mono">
                {HOUR_TICKS.includes(band) ? fmtBand(band) : ""}
              </span>
            );
          })}
        </div>
      </div>
      <div className="fmap-legend">
        <span><i className="swatch" style={{ background: "var(--surplus)" }} /> Surplus — hours people have</span>
        <span><i className="swatch" style={{ background: "var(--deficit)" }} /> Deficit — hours that are hard</span>
        <span><i className="swatch" style={{ background: "var(--gap)" }} /> The gap — need with no one routed to it</span>
      </div>
    </div>
  );
}
