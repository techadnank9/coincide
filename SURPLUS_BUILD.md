# SURPLUS — solo build brief

Supersedes HANDOFF.md. One builder, ~6h45m. Read fully before writing code.

**No test cases. None. Not unit, not integration, not e2e. Do not write a
`__tests__` directory, do not add vitest or jest, do not scaffold a test
runner. Verification today is: run it, look at it, does it work. That is the
whole QA strategy and it is the correct one for a six-hour build.**

---

## 1. The event

One-day AI hackathon, Japantown SF, sponsored by **ClickHouse**. Venue 18+.

| Time | |
|---|---|
| 09:30 | Doors, coffee, check in |
| 10:00 | Kickoff — rules, tracks, tools |
| 10:15 | Hacking begins. Expert bar opens (ClickHouse engineers on-site all day) |
| **17:00** | **Submissions close — hard wall** |
| 17:05 | Demos to judges; selected teams present to full crowd |
| 18:00 | Dinner + awards |

Breakfast, lunch, drinks provided. Teams up to 5 — **we are going solo.**

### Sponsors and who is actually judging

**ClickHouse** — the host. Open-source columnar OLAP database, built for
scanning billions of rows in milliseconds. Their engineers staff the expert
bar all day and they are in the judging room. This is the single most
important fact about this hackathon: **the people scoring you built the
database.** They will know instantly whether ClickHouse is load-bearing or
decorative in your project. Most teams will bolt it on as a logging sink.
Do not be most teams.

Use the expert bar. Around 11:30, when the matching query exists but is slow,
walk over and ask a ClickHouse engineer to look at the ORDER BY key. It costs
ten minutes, will likely save an hour, and it puts your project in a judge's
head five hours before demos.

**Postgres** — co-mandated. The framing from the organizers was OLAP and OLTP
together, "like PB&J." Both must be present and both must be doing work the
other genuinely can't.

**LibreChat** — bonus category, **$250 cash**, separate pool, far fewer
entrants. Worth two hours late in the day if the core loop is done.

### Prizes

- 🥇 $1,000 cash + $500 ClickHouse Cloud credits
- 🥈 $500 cash + $300 credits
- ⭐ LibreChat bonus — $250 cash
- 🎉 Social raffle — physical gift (post about the build during the day; it's free entry)

### Track

**The loneliness epidemic.** Organizers' framing: half of American adults are
lonely, worse among the young; build for the communities trying to hold people
together — senior centers, campus groups, neighborhoods.

Their stated bar: *"Build something someone would actually open on a hard day."*

---

## 2. Complete reasoning — why this project, why this shape

### Why the loneliness track

The reading track is the most obvious ClickHouse fit and will therefore be the
most crowded. Climate splits into either a rebate lookup (a database query
wearing a costume) or a dashboard. Loneliness is the track where most teams
will build something emotionally earnest and technically thin — a chat app, a
buddy finder, an AI companion. That leaves an opening for a project that is
emotionally serious *and* has a real reason to scan a billion rows.

### Why "loneliness as a supply chain problem"

Every existing product in this space matches on **identity** — interests,
demographics, personality — and then leaves scheduling as an exercise for the
user. This is backwards, and it is why they fail. The interests were never the
bottleneck. The bottleneck is that two people's free hours never line up, and
by the time they've traded four messages about it, the impulse is gone.

Invert it. People declare **time**, not identity. A retired man has a wide
open Tuesday afternoon. A new mother has a Tuesday afternoon that is
unbearable. Neither is shopping for a friend. Both have a time problem, and
the time is complementary. Match the hours first; compatibility is a filter,
not the primary key.

The framing gives you a demo line nobody else in the room will have:

> **We are not matching people. We are routing hours.**

### Why this genuinely needs ClickHouse

This is the part to be able to defend under questioning, because you will be
questioned.

The matching signal is not the profile. **It is the history of showing up.**

Everything that matters is append-only: every declared availability window,
every proposed match, every accept, every decline, every attendance
confirmation, every cancellation and how much lead time it had. To produce a
good match you run a cohort trajectory query — *among people whose historical
show-up rate in this time band, at this distance, at this group size clears
threshold, which pairing has the highest predicted fulfillment?*

That is a scan over tens of millions of rows with high-cardinality grouping,
and it has to return before a page finishes loading. It is a MergeTree query.
Postgres could do it only by precomputing a materialized rollup per query
shape, and would still lose — and the moment you want to slice by a new
dimension, you'd be rebuilding rollups instead of writing a WHERE clause.

Meanwhile the *people* are relational, mutable, and transactional. Accounts,
verified org membership, consent records, current match state. A match
acceptance is a two-sided state change that must not half-commit — if one side
accepts and the write partially fails, you have a person who thinks they have
a Tuesday and a person who doesn't. That is Postgres, in a real transaction.

**One sentence each, memorize both:**
- **Postgres = who exists, who consented, what is currently true.**
- **ClickHouse = what has happened, at volume, queried across cohorts.**

### Why synthetic history is correct and not a compromise

A two-sided matching product cannot be demonstrated empty. With no history the
freight map is blank and the ranking query returns nothing. This is the one
product category where a live-but-empty demo is strictly worse than a seeded
one.

So: **the application is real and every path is live** — a person signing up
during demos flows through exactly the same code as the seeded population. The
*history* behind it is modeled. Say this plainly on stage. Judges respect a
clean disclosure and they will read the seeded volume for what it actually is:
a load test, which is the ClickHouse story.

### Why solo changes the plan

The previous brief assumed slack that doesn't exist for one person. The
revision: **one vertical slice, working end to end, by 14:00.** Everything
after that is additive and individually droppable. A hackathon project that
does one thing completely beats one that does five things partially, and the
solo failure mode is always the same — four half-built surfaces and nothing
you can walk a judge through.

---

## 3. The one functionality that must work first

**Slice: a coordinator sees the gap, picks a person, and routes them an hour.**

Nothing else ships until this runs end to end. Concretely:

1. Coordinator opens `/coordinator` for one org.
2. Freight map renders — surplus hours vs deficit hours by weekday × time
   band, drawn from a live ClickHouse query over the full seeded volume, with
   row count and query latency shown on screen.
3. Coordinator clicks a person whose deficit is climbing.
4. Ranked candidate list appears — the matching query, live.
5. Coordinator proposes a match. Writes to Postgres in a transaction.
6. Match appears as `proposed`, and can be accepted from a second persona view.

That's it. That is a complete, demoable product. If nothing else gets built
today, this wins something.

**Explicitly deferred, in the order to add them back:**
Claude-written match rationale → LibreChat coordinator chat → public `/join`
intake → recurring availability → anything else.

---

## 4. Function flow

The full path, in order. Build it in this order too.

```
DECLARE
  person states an hour they have or an hour that's hard
  → POST /api/availability
  → INSERT into Postgres `availability`   (current truth)
  → INSERT event {type:'declared'} into ClickHouse `hour_events`  (history)

MAP
  coordinator opens /coordinator
  → GET /api/map?org_id=
  → ClickHouse: surplus vs deficit density, org × weekday × 30-min band
  → returns grid + rows_scanned + elapsed_ms
  → render freight map. The gap is visible.

SURFACE
  → GET /api/drifting?org_id=
  → ClickHouse: deficit-hour trajectory per user, month over month,
    ranked by slope, filtered to those unmatched in N weeks
  → these are people whose attendance looks fine and whose need is climbing.
    Attendance is a level; the trajectory is the signal. That distinction is
    the intellectual core of the product — say it in the demo.

ROUTE
  coordinator picks one person
  → GET /api/candidates?user_id=&slot=
  → ClickHouse, the query that is the whole product:

      score = temporal_overlap
            × reliability            (attended / attended+no_show, windowed)
            × proximity_decay        (exp decay on distance_m)
            × shape_fulfillment      (historical success at this distance
                                      bucket × group size × lead time bucket)

  → returns ranked candidates, each with its component scores exposed.
    Exposing the components is what makes it legible instead of a magic number.

PROPOSE
  → POST /api/match
  → Postgres TRANSACTION: insert `matches` state='proposed', lock both users
  → ClickHouse: event {type:'proposed'}

ACCEPT
  second persona accepts
  → POST /api/match/:id/accept
  → Postgres TRANSACTION: two-sided state change to 'accepted'.
    Both sides commit or neither does.
  → ClickHouse: event {type:'accepted'}

CLOSE THE LOOP
  → attendance confirmed or not
  → ClickHouse: event {type:'attended'|'no_show', lead_time_min}
  → this feeds straight back into reliability and shape_fulfillment.
    The system learns from what actually happened. Show this arrow on the
    architecture slide — it's what makes it a routing system rather than a
    recommender.
```

---

## 5. Data

### Postgres

```sql
orgs         (id, name, kind)          -- senior_center | campus | neighborhood
users        (id, display_name, org_id, zip, seeded bool, created_at)
consent      (user_id, share_level, revoked_at)
availability (id, user_id, weekday, start_min, end_min, kind, radius_m)
             -- kind: 'surplus' | 'deficit'
matches      (id, user_a, user_b, slot_start, slot_end, place_label,
              state, created_at)
             -- state: proposed|accepted|declined|completed|no_show
```

`seeded` on users so the coordinator view can distinguish modeled people from
real signups. Small detail, reads as integrity on stage.

### ClickHouse

```sql
CREATE TABLE hour_events (
    event_time      DateTime64(3),
    event_type      LowCardinality(String),
    user_id         UInt64,
    counterpart_id  UInt64,
    org_id          UInt32,
    weekday         UInt8,
    start_min       UInt16,
    duration_min    UInt16,
    kind            LowCardinality(String),
    distance_m      UInt32,
    group_size      UInt8,
    lead_time_min   Int32,
    match_id        UInt64
) ENGINE = MergeTree
ORDER BY (org_id, weekday, start_min, user_id);
```

Materialized views: `mv_reliability`, `mv_band_density` (the freight map),
`mv_shape_outcomes`.

### Seed — build this first, before any UI

Target **50M events**, ~30k users, ~40 orgs, 18 months. Insert via native
protocol in 100k batches. If generation is slow, drop to 20M rather than
losing the morning — 20M still scans impressively and still looks real.

Give the population structure. Uniform noise returns boring results:

- ~15% chronic no-showers, ~20% highly reliable, rest between
- Retirees: surplus weekdays 10:00–15:00
- New parents: deficit weekdays 13:00–16:00 and 19:00–21:00
- Students: deficit late evening, surplus weekend mornings
- Reliability decays with distance and with long lead times
- December dip, January spike
- **Plant ~20 users whose deficit density climbs month over month while
  their attendance stays flat.** These are who the system catches. Pick one
  and build the demo around her.

---

## 6. Visual bar

Read `/mnt/skills/public/frontend-design/SKILL.md` before writing UI.

The freight map is the product. It has to be beautiful and legible in one
glance — surplus hours in one color, deficit in another, and the gap where
they fail to meet as the thing your eye lands on first. If a judge understands
the entire thesis from that one image without narration, it's right.

- Restrained palette. Real typographic hierarchy. Generous whitespace.
- No purple gradient, no glassmorphism, no emoji in the UI.
- Motion only where it explains — hours routing from surplus to deficit.
  Nothing decorative.
- Leave an empty, clearly-marked hero media slot. Shoot assets on the day:
  empty chairs, a full room, a bench, ten minutes on a phone in Japantown.
  **Do not use stock photography of lonely seniors at windows.** It's the
  visual cliché of this entire category and it reads as unserious.
- Always visible: rows scanned and query latency. It's both an honest
  engineering detail and the thing the judges care most about.

---

## 7. Clock

| Time | |
|---|---|
| 10:15 | docker-compose up: Postgres + ClickHouse. Both schemas applied. |
| 10:40 | Seed generator running. Let it grind in the background. |
| 11:30 | Matching query written and tuned against real volume. **Take it to the expert bar.** |
| 12:15 | Next.js scaffold. One route: `/coordinator`. |
| 13:00 | Freight map rendering from live ClickHouse. |
| 14:00 | **Slice complete** — propose + two-sided accept in a Postgres transaction. |
| 14:30 | Claude match rationale. |
| 15:15 | LibreChat coordinator chat ($250). |
| 16:00 | Visual pass. Shoot hero media. |
| **16:15** | **Hard feature freeze.** |
| 16:30 | Rehearse the demo out loud, twice, with a timer. |
| 17:00 | Submit. |

If behind at 15:00, cut in this order: LibreChat → Claude rationale →
`/join` intake. **Never cut the freight map.**

The 16:15 freeze is real. More projects lose on an unrehearsed demo than on a
thin feature set, and solo means nobody else has run through it.

---

## 8. Safety — one slide, thirty seconds

Matching strangers has obvious failure modes and a judge will ask. Have the
answer built, not improvised:

- Matches happen **within a verified org**. No open stranger matching.
- First meetings default to public places; the venue is suggested, not
  free-entry.
- Both parties confirm attendance. A no-show is logged and changes routing.
- Consent is explicit, stored in Postgres, revocable.
- Coarse radius only. No precise location.

---

## 9. Demo — three minutes, one person

Do not tour the app. Follow one human.

1. **Freight map.** Whole org, 18 months, live query. Say the row count and
   latency out loud. *(20s)*
2. **Margaret, 71.** Deficit hours climbing every month since March, flagged
   by nobody, because she still shows up to Thursday lunch. Her attendance is
   fine. Her trajectory isn't. *(40s)*
3. **The route.** Ranked candidates with component scores visible. Ray —
   six-minute walk, eleven of his last twelve. Show why him over the
   higher-affinity match who no-shows. *(40s)*
4. **The accept.** Two-sided, transactional, Postgres. *(30s)*
5. **"Who's drifting?"** in LibreChat, ten names back. *(20s)*
6. **Close on the number.** "Postgres holds who these people are. ClickHouse
   holds what's happened to them. Neither does this alone." *(10s)*

Land it on the latency. They built that engine.

---

## 10. Engineering notes

- TypeScript. Raw SQL both sides, **no ORM** — costs an hour, buys nothing today.
- `@clickhouse/client`, native protocol for seed inserts.
- **No auth.** Three hardcoded personas and a switcher.
- **No mobile view.**
- **No tests.** Repeating because the instinct will resurface around hour four
  when something breaks: do not write a test to find it. Add a log line, look
  at it, fix it, delete the log.
- Commit constantly. Solo means no one else remembers what worked twenty
  minutes ago.
- Stop and ask rather than guessing when the spec is ambiguous.
