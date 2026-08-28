import { NextRequest, NextResponse } from "next/server";
import { chQuery, pg } from "@/lib/db";

const DAY_WORDS: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Match people to plain-language criteria: days, times of day, interests.
async function matchPeople(query: string): Promise<string> {
  const q = query.toLowerCase();
  const wantDays = Object.entries(DAY_WORDS)
    .filter(([w]) => q.includes(w) || q.includes(w.slice(0, 3) + " "))
    .map(([, n]) => n);
  // relative days, in the community's timezone
  const laNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  const todayW = laNow.getDay();
  if (/\btomorrow\b/.test(q)) wantDays.push((todayW + 1) % 7);
  if (/\btoday\b|\btonight\b/.test(q)) wantDays.push(todayW);
  if (/\bweekend\b/.test(q)) wantDays.push(0, 6);
  if (/\bweek\b/.test(q) && !wantDays.length) wantDays.push(1, 2, 3, 4, 5);
  let band: [number, number] | null = null;
  if (/morning/.test(q)) band = [300, 720];
  else if (/afternoon/.test(q)) band = [720, 1020];
  else if (/evening|tonight|night/.test(q)) band = [1020, 1380];

  const res = await pg.query(
    `SELECT u.id, u.display_name, p.handle, p.bio, p.interests, o.name AS org,
            coalesce(json_agg(json_build_object('weekday', a.weekday, 'start_min', a.start_min,
              'end_min', a.end_min, 'kind', a.kind)) FILTER (WHERE a.id IS NOT NULL), '[]') AS windows
     FROM profiles p
     JOIN users u ON u.id = p.user_id
     JOIN orgs o ON o.id = u.org_id
     LEFT JOIN availability a ON a.user_id = u.id
     GROUP BY u.id, p.handle, p.bio, p.interests, o.name`,
  );

  const scored = res.rows
    .map((r) => {
      const interests: string[] = r.interests ?? [];
      const hitTags = interests.filter((t) =>
        t.toLowerCase().split(/\s+/).some((w) => w.length > 3 && q.includes(w)),
      );
      const bioHit = (r.bio ?? "")
        .toLowerCase()
        .split(/\W+/)
        .some((w: string) => w.length > 4 && q.includes(w));
      const wins = (r.windows as any[]).filter(
        (w) =>
          (!wantDays.length || wantDays.includes(Number(w.weekday))) &&
          (!band || (Number(w.start_min) < band[1] && Number(w.end_min) > band[0])),
      );
      const timeAsked = wantDays.length > 0 || band !== null;
      let score = hitTags.length * 3 + (bioHit ? 1 : 0);
      if (timeAsked && wins.length) score += 2;
      if (timeAsked && !wins.length) score -= 2;
      return { r, hitTags, wins, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  // nothing specific asked, or nothing hit: offer people with open hours anyway
  let pool = scored;
  if (!pool.length) {
    pool = res.rows
      .map((r) => {
        const wins = (r.windows as any[]).filter((w) => w.kind === "surplus");
        return { r, hitTags: [] as string[], wins, score: wins.length };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    if (!pool.length) {
      return `Nobody jumped out for that. Try a day, a time of day, or an interest — "someone free Tuesday evenings who likes chess", "morning walkers", "anybody free tomorrow".`;
    }
  }
  const scoredFinal = pool;
  const lines = scoredFinal.map(({ r, hitTags, wins }, i) => {
    const why = [
      hitTags.length ? `into ${hitTags.join(", ")}` : null,
      wins.length
        ? `free ${DAYS[Number(wins[0].weekday)]} ${String(Math.floor(wins[0].start_min / 60)).padStart(2, "0")}:${String(wins[0].start_min % 60).padStart(2, "0")}`
        : null,
    ]
      .filter(Boolean)
      .join(" · ");
    return `${i + 1}. **${r.display_name}** (${r.handle}, ${r.org}) — ${r.bio}\n   ${why ? why + " · " : ""}profile: https://trycoincide.vercel.app/people/${r.id}`;
  });
  return `People whose hours and interests fit what you asked:\n\n${lines.join("\n\n")}\n\nOpen a profile to see their next plans, or message them right there.`;
}

// OpenAI-compatible chat completions endpoint, so LibreChat can talk to
// Coincide as a custom endpoint (librechat.yaml snippet in the README).
// Members: "find me people free Tuesday evenings who like chess".
// Coordinators: "Who's drifting?" → live ClickHouse trajectory scan.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const messages: { role: string; content: string }[] = body.messages ?? [];
  const last = messages.filter((m) => m.role === "user").pop()?.content ?? "";

  let answer: string;
  if (/drift|slipping|worry|check on|climbing|trajector/i.test(last)) {
    const { rows, stats } = await chQuery<{
      user_id: string;
      slope: number;
      total_attended: string;
    }>(
      `WITH monthly AS (
         SELECT user_id, toStartOfMonth(event_time) AS month,
                countIf(event_type = 'declared' AND kind = 'deficit') AS deficit_hours,
                countIf(event_type = 'attended') AS attended
         FROM surplus.hour_events
         WHERE event_time > now() - INTERVAL 8 MONTH
         GROUP BY user_id, month
       )
       SELECT user_id,
              round(covarPop(toUnixTimestamp(month) / 2592000, deficit_hours)
                / greatest(varPop(toUnixTimestamp(month) / 2592000), 0.001), 1) AS slope,
              sum(attended) AS total_attended
       FROM monthly
       GROUP BY user_id
       HAVING count() >= 4 AND sum(deficit_hours) > 40 AND slope > 2
       ORDER BY slope DESC
       LIMIT 10`,
    );
    const ids = rows.map((r) => Number(r.user_id));
    const names = ids.length
      ? await pg.query(
          `SELECT u.id, u.display_name, o.name AS org FROM users u JOIN orgs o ON o.id = u.org_id WHERE u.id = ANY($1)`,
          [ids],
        )
      : { rows: [] };
    const byId = new Map(names.rows.map((n) => [Number(n.id), n]));
    const lines = rows.map((r, i) => {
      const u = byId.get(Number(r.user_id));
      return `${i + 1}. ${u?.display_name ?? "#" + r.user_id} (${u?.org ?? "?"}) — hard hours climbing +${r.slope}/month, still attending (${r.total_attended} showed).`;
    });
    answer =
      `People whose need is climbing while their attendance looks fine — ` +
      `ranked by deficit-hour slope over the last 8 months, ` +
      `${stats.rows_read.toLocaleString()} events scanned in ${stats.elapsed_ms} ms:\n\n` +
      (lines.join("\n") || "Nobody is drifting right now.") +
      `\n\nAttendance is a level. The trajectory is the signal.`;
  } else if (/find|match|meet|who|people|someone|anyone|free|likes?|into|near/i.test(last)) {
    answer = await matchPeople(last);
  } else {
    answer =
      `I match people by hours and interests. Try: "someone free Tuesday evenings who likes chess", ` +
      `"morning walkers", or (for coordinators) "who's drifting?".`;
  }

  // With an OpenAI key, let a model phrase the reply warmly; the facts,
  // names, and links come only from our data above.
  if (process.env.OPENAI_API_KEY) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 12000);
      const oa = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.4,
          messages: [
            {
              role: "system",
              content:
                "You are Coincide's community assistant. Coincide connects people whose free hours line up, inside their own community center. You are given a data-grounded draft answer. Rewrite it as a warm, plain, human reply. Keep every name, number, handle, and URL exactly as given. Never invent people or facts. No emoji. Keep it brief. Write URLs as bare plain text (https://...); never use HTML tags or markdown link syntax.",
            },
            ...messages.slice(-4),
            { role: "system", content: `Draft answer from the database:\n${answer}` },
          ],
        }),
      });
      clearTimeout(t);
      if (oa.ok) {
        const od = await oa.json();
        const text = od.choices?.[0]?.message?.content;
        if (text) answer = text;
      }
    } catch {}
  }

  const model = body.model ?? "surplus-coordinator";
  const created = Math.floor(Date.now() / 1000);

  if (body.stream) {
    const enc = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const chunk = (delta: object, finish: string | null = null) =>
          enc.encode(
            `data: ${JSON.stringify({
              id: "chatcmpl-surplus",
              object: "chat.completion.chunk",
              created,
              model,
              choices: [{ index: 0, delta, finish_reason: finish }],
            })}\n\n`,
          );
        controller.enqueue(chunk({ role: "assistant", content: answer }));
        controller.enqueue(chunk({}, "stop"));
        controller.enqueue(enc.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });
    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  }

  return NextResponse.json({
    id: "chatcmpl-surplus",
    object: "chat.completion",
    created,
    model,
    choices: [
      { index: 0, message: { role: "assistant", content: answer }, finish_reason: "stop" },
    ],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  });
}
