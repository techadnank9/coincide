// SURPLUS seed generator — spec §5.
// ~30k users, ~40 orgs, 18 months, target 50M events into ClickHouse.
// Population is structured, not uniform: archetypes, reliability tiers,
// seasonality, and ~20 planted drifters (deficit climbing, attendance flat).

import { createClient } from "@clickhouse/client";
import { Client as PgClient } from "pg";

const TARGET_EVENTS = Number(process.env.TARGET_EVENTS ?? 50_000_000);
const N_USERS = 30_000;
const N_ORGS = 40;
const WEEKS = 78; // ~18 months
const END = new Date("2026-08-28T00:00:00Z").getTime();
const START = END - WEEKS * 7 * 86400_000;
const BATCH = 100_000;

// deterministic PRNG
let s = 0xc0ffee;
function rnd() {
  s |= 0; s = (s + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const ri = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];

type Archetype = "retiree" | "new_parent" | "student" | "general";
interface Window { weekday: number; start: number; end: number; kind: "surplus" | "deficit"; }
interface User {
  id: number; name: string; org: number; zip: string;
  archetype: Archetype; reliability: number; // base attend prob
  windows: Window[]; drifter: boolean; activity: number;
}

const FIRST = ["Margaret","Ray","Alma","Hector","June","Walt","Priya","Sam","Nora","Dev","Rosa","Ken","Mei","Tomás","Ada","Gus","Lena","Omar","Ivy","Cal","Ruth","Ben","Sana","Joel","Faye","Marc","Tess","Hugo","Wren","Ed"];
const LAST = ["Okafor","Lindqvist","Tanaka","Reyes","Whitfield","Nguyen","Adebayo","Kowalski","Marsh","Ito","Serrano","Boone","Haddad","Petrov","Lam","Ferris","Osei","Vega","Nakamura","Cole"];

function windowsFor(a: Archetype): Window[] {
  const ws: Window[] = [];
  if (a === "retiree") {
    for (let d = 1; d <= 5; d++) if (rnd() < 0.7) ws.push({ weekday: d, start: 600, end: 900, kind: "surplus" });
  } else if (a === "new_parent") {
    for (let d = 1; d <= 5; d++) {
      if (rnd() < 0.6) ws.push({ weekday: d, start: 780, end: 960, kind: "deficit" });
      if (rnd() < 0.5) ws.push({ weekday: d, start: 1140, end: 1260, kind: "deficit" });
    }
  } else if (a === "student") {
    for (let d = 1; d <= 5; d++) if (rnd() < 0.5) ws.push({ weekday: d, start: 1200, end: 1380, kind: "deficit" });
    for (const d of [0, 6]) if (rnd() < 0.6) ws.push({ weekday: d, start: 540, end: 720, kind: "surplus" });
  } else {
    const n = ri(1, 3);
    for (let i = 0; i < n; i++) {
      const st = ri(16, 40) * 30;
      ws.push({ weekday: ri(0, 6), start: st, end: st + ri(2, 5) * 30, kind: rnd() < 0.5 ? "surplus" : "deficit" });
    }
  }
  if (ws.length === 0) ws.push({ weekday: ri(0, 6), start: 600, end: 720, kind: "surplus" });
  return ws;
}

function makePopulation() {
  const orgs = Array.from({ length: N_ORGS }, (_, i) => ({
    id: i + 1,
    kind: i % 3 === 0 ? "senior_center" : i % 3 === 1 ? "campus" : "neighborhood",
    name: `${pick(["Japantown","Sunset","Mission","Richmond","Bayview","Fillmore","Presidio","Glen Park","Noe","Portola"])} ${i % 3 === 0 ? "Senior Center" : i % 3 === 1 ? "Campus Commons" : "Neighborhood Circle"} #${i + 1}`,
  }));
  const users: User[] = [];
  for (let i = 1; i <= N_USERS; i++) {
    const org = orgs[(i - 1) % N_ORGS];
    const archetype: Archetype =
      org.kind === "senior_center" ? (rnd() < 0.75 ? "retiree" : "general")
      : org.kind === "campus" ? (rnd() < 0.75 ? "student" : "general")
      : rnd() < 0.35 ? "new_parent" : rnd() < 0.5 ? "retiree" : "general";
    const r = rnd();
    const reliability = r < 0.15 ? 0.25 + rnd() * 0.15 : r < 0.35 ? 0.92 + rnd() * 0.06 : 0.6 + rnd() * 0.25;
    users.push({
      id: i,
      name: `${FIRST[i % FIRST.length]} ${LAST[i % LAST.length]}`,
      org: org.id, zip: `941${ri(2, 34).toString().padStart(2, "0")}`,
      archetype, reliability, windows: windowsFor(archetype),
      drifter: false, activity: 0.6 + rnd() * 0.8,
    });
  }
  // ~20 planted drifters: deficit density climbs month over month, attendance flat.
  const addDeficitWindows = (u: User) => {
    // the drift needs somewhere to show up: evening + weekend deficit hours
    u.windows.push({ weekday: ri(1, 5), start: 1140, end: 1260, kind: "deficit" });
    u.windows.push({ weekday: pick([0, 6]), start: 840, end: 990, kind: "deficit" });
  };
  const drifterIds: number[] = [];
  for (let k = 0; k < 20; k++) {
    const u = users[100 + k * 1400];
    u.drifter = true; u.reliability = Math.max(u.reliability, 0.85);
    addDeficitWindows(u);
    drifterIds.push(u.id);
  }
  // Demo pair, org 1 (senior center): Margaret drifts, Ray is ultra-reliable nearby.
  const margaret = users[0];
  margaret.name = "Margaret Okafor"; margaret.archetype = "retiree";
  margaret.windows = windowsFor("retiree"); margaret.drifter = true;
  margaret.reliability = 0.9; margaret.org = 1; margaret.zip = "94115";
  addDeficitWindows(margaret);
  const ray = users[40]; // same org (id 41 → org 1)
  ray.name = "Ray Tanaka"; ray.archetype = "retiree";
  ray.windows = windowsFor("retiree"); ray.reliability = 0.94; ray.org = 1; ray.zip = "94115";
  return { orgs, users };
}

function seasonMult(t: number): number {
  const m = new Date(t).getUTCMonth();
  return m === 11 ? 0.6 : m === 0 ? 1.35 : 1.0;
}

async function seedPostgres(orgs: any[], users: User[]) {
  const pg = new PgClient({ database: "surplus" });
  await pg.connect();
  await pg.query("TRUNCATE matches, availability, consent, users, orgs RESTART IDENTITY CASCADE");
  for (const o of orgs)
    await pg.query("INSERT INTO orgs (id, name, kind) VALUES ($1,$2,$3)", [o.id, o.name, o.kind]);
  for (let i = 0; i < users.length; i += 1000) {
    const chunk = users.slice(i, i + 1000);
    const vals: any[] = []; const rows: string[] = [];
    chunk.forEach((u, j) => {
      rows.push(`($${j * 5 + 1},$${j * 5 + 2},$${j * 5 + 3},$${j * 5 + 4},$${j * 5 + 5})`);
      vals.push(u.id, u.name, u.org, u.zip, true);
    });
    await pg.query(`INSERT INTO users (id, display_name, org_id, zip, seeded) VALUES ${rows.join(",")}`, vals);
  }
  await pg.query("SELECT setval('users_id_seq', $1)", [N_USERS + 1]);
  await pg.query("INSERT INTO consent (user_id, share_level) SELECT id, 'org' FROM users");
  // availability = current truth: each user's windows
  const avVals: string[] = [];
  for (const u of users)
    for (const w of u.windows)
      avVals.push(`(${u.id},${w.weekday},${w.start},${w.end},'${w.kind}',${ri(500, 4000)})`);
  for (let i = 0; i < avVals.length; i += 5000)
    await pg.query(`INSERT INTO availability (user_id, weekday, start_min, end_min, kind, radius_m) VALUES ${avVals.slice(i, i + 5000).join(",")}`);
  await pg.end();
  console.log(`postgres seeded: ${orgs.length} orgs, ${users.length} users, ${avVals.length} availability rows`);
}

async function main() {
  const { orgs, users } = makePopulation();
  await seedPostgres(orgs, users);

  const ch = createClient({ url: "http://localhost:8123" });
  await ch.command({ query: "TRUNCATE TABLE surplus.hour_events" });

  // Scale activity so total lands near TARGET_EVENTS.
  // Per user-week events ≈ activity * (declared per window ~4.5 + match funnel ~3)
  const estPerUserWeek = users.reduce((a, u) => a + u.activity * (u.windows.length * 4.5 + 3), 0) / users.length;
  const scale = TARGET_EVENTS / (estPerUserWeek * N_USERS * WEEKS);

  let buf: any[] = [];
  let total = 0; let matchId = 0;
  const t0 = Date.now();
  async function flush() {
    if (!buf.length) return;
    await ch.insert({ table: "surplus.hour_events", values: buf, format: "JSONEachRow" });
    total += buf.length; buf = [];
    const rate = Math.round(total / ((Date.now() - t0) / 1000));
    console.log(`inserted ${(total / 1e6).toFixed(1)}M events (${rate}/s)`);
  }
  const ev = (o: Partial<Record<string, any>>) => {
    buf.push({
      event_time: o.event_time, event_type: o.event_type,
      user_id: o.user_id, counterpart_id: o.counterpart_id ?? 0,
      org_id: o.org_id, weekday: o.weekday, start_min: o.start_min,
      duration_min: o.duration_min ?? 60, kind: o.kind ?? "",
      distance_m: o.distance_m ?? 0, group_size: o.group_size ?? 2,
      lead_time_min: o.lead_time_min ?? 0, match_id: o.match_id ?? 0,
    });
  };

  const byOrg = new Map<number, User[]>();
  for (const u of users) {
    if (!byOrg.has(u.org)) byOrg.set(u.org, []);
    byOrg.get(u.org)!.push(u);
  }

  for (let w = 0; w < WEEKS; w++) {
    const weekStart = START + w * 7 * 86400_000;
    const season = seasonMult(weekStart);
    const monthFrac = w / WEEKS; // 0 → 1 across 18 months, drives drifter ramp
    for (const u of users) {
      const act = u.activity * season * scale;
      // DECLARED — the bulk of the volume
      for (const win of u.windows) {
        let n = act * 4.5 * (0.7 + rnd() * 0.6);
        // drifters: deficit declarations ramp up month over month
        if (u.drifter && win.kind === "deficit") n *= 1 + 3.5 * monthFrac;
        for (let k = Math.floor(n + rnd()); k > 0; k--) {
          ev({
            event_time: weekStart + win.weekday * 86400_000 + win.start * 60_000 + ri(0, 3600_000),
            event_type: "declared", user_id: u.id, org_id: u.org,
            weekday: win.weekday, start_min: win.start + ri(0, 2) * 30,
            duration_min: Math.min(win.end - win.start, ri(1, 4) * 30), kind: win.kind,
          });
        }
        // drifters also grow new deficit windows over time
        if (u.drifter && monthFrac > 0.4 && rnd() < 0.35 * monthFrac * act) {
          ev({
            event_time: weekStart + ri(0, 6) * 86400_000 + ri(480, 1200) * 60_000,
            event_type: "declared", user_id: u.id, org_id: u.org,
            weekday: ri(0, 6), start_min: ri(16, 42) * 30, duration_min: 60, kind: "deficit",
          });
        }
      }
      // MATCCH FUNNEL — proposed → accepted/declined → attended/no_show
      let m = act * 1.0;
      for (let k = Math.floor(m + rnd()); k > 0; k--) {
        const peers = byOrg.get(u.org)!;
        const other = peers[Math.floor(rnd() * peers.length)];
        if (other.id === u.id) continue;
        const win = pick(u.windows);
        const dist = ri(200, 8000);
        const lead = ri(30, 7 * 1440);
        const gs = rnd() < 0.85 ? 2 : ri(3, 6);
        const t = weekStart + win.weekday * 86400_000 + win.start * 60_000;
        const id = ++matchId;
        const base = { org_id: u.org, weekday: win.weekday, start_min: win.start, kind: win.kind, distance_m: dist, group_size: gs, lead_time_min: lead, match_id: id };
        ev({ ...base, event_time: t - lead * 60_000, event_type: "proposed", user_id: u.id, counterpart_id: other.id });
        if (rnd() < 0.65) {
          ev({ ...base, event_time: t - lead * 60_000 + ri(5, 600) * 60_000, event_type: "accepted", user_id: other.id, counterpart_id: u.id });
          // reliability decays with distance and long lead times; drifters stay flat (that's the point)
          let p = (u.reliability + other.reliability) / 2;
          p *= Math.exp(-dist / 12000) / Math.exp(-2000 / 12000);
          if (lead > 3 * 1440) p *= 0.85;
          const attended = rnd() < Math.min(p, 0.98);
          ev({ ...base, event_time: t + 30 * 60_000, event_type: attended ? "attended" : "no_show", user_id: u.id, counterpart_id: other.id });
          ev({ ...base, event_time: t + 30 * 60_000, event_type: attended ? "attended" : "no_show", user_id: other.id, counterpart_id: u.id });
        } else if (rnd() < 0.5) {
          ev({ ...base, event_time: t - lead * 60_000 + ri(5, 600) * 60_000, event_type: "declined", user_id: other.id, counterpart_id: u.id });
        }
      }
      if (buf.length >= BATCH) await flush();
    }
  }
  await flush();
  await ch.close();
  console.log(`DONE: ${total} events in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
}

main().catch((e) => { console.error(e); process.exit(1); });
