# Coincide

**We are not matching people. We are routing hours.**

Loneliness apps match on identity and leave scheduling to the user — which is
why they fail. Coincide inverts it: people declare **time** (surplus hours they
have, deficit hours that are hard alone), and an org coordinator routes one
person's surplus hour into another's deficit hour.

- **Postgres** — who exists, who consented, what is currently true. Match
  accepts are two-sided transactions: both sides commit or neither does.
- **ClickHouse** — what has happened, at volume: 50M behavioral events
  (declared hours, proposals, accepts, attendance, no-shows) over 18 months,
  scanned live under every screen. Rows read and latency are always on screen.

The seeded history is modeled (disclosed on stage); every application path is
real — a live signup at `/join` flows through the same code as the seeded
population and appears on the coordinator's map marked "signed up live."

## Run

```bash
brew services start postgresql@17       # Postgres on :5432, db "surplus"
cd .clickhouse && clickhouse server &   # ClickHouse on :8123
npm run dev                             # Next.js on :3000
```

Schemas: `db/postgres.sql`, `db/clickhouse.sql`. Reseed (~1 min for 50M
events): `npx tsx seed/seed.ts`.

## Surfaces

| Route | What |
|---|---|
| `/coordinator` | Freight map (surplus vs deficit density, org × weekday × 30-min band), "who's drifting" trajectory ranking, candidate routing with exposed score components, propose |
| `/me?as=1` / `/me?as=41` | Member personas (Margaret / Ray) — accept a routed hour |
| `/join` | Public intake — declare an hour, live |

The matching score, per candidate, every component visible:

```
score = temporal_overlap × reliability × proximity_decay × shape_fulfillment
```

## LibreChat wiring

`/api/chat/completions` is OpenAI-compatible. In `librechat.yaml`:

```yaml
endpoints:
  custom:
    - name: "Coincide"
      apiKey: "none"
      baseURL: "http://localhost:3000/api"
      models:
        default: ["surplus-coordinator"]
      titleConvo: false
```

Ask **"Who's drifting?"** — ten names back, ranked by deficit-hour slope,
straight off a 50M-event scan with the latency printed in the answer.

## Safety (one slide)

Matches only within a verified org. First meetings default to public places.
Both parties confirm attendance; no-shows change future routing. Consent is
explicit, stored in Postgres, revocable. Coarse radius only — no precise
location.

## Demo (3 minutes — follow one human)

1. Freight map. Say the row count and latency out loud. *(20s)*
2. Margaret, 71 — deficit climbing since March, flagged by nobody because she
   still shows up to Thursday lunch. Attendance is a level; the trajectory is
   the signal. *(40s)*
3. The route: Ray — six-minute walk, shows up. Why him over the
   higher-overlap candidate who no-shows. *(40s)*
4. The accept — two-sided, transactional, Postgres. *(30s)*
5. "Who's drifting?" in LibreChat — ten names back. *(20s)*
6. "Postgres holds who these people are. ClickHouse holds what's happened to
   them. Neither does this alone." *(10s)*
