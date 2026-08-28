import { NextRequest, NextResponse } from "next/server";
import { chQuery, pg } from "@/lib/db";

// OpenAI-compatible chat completions endpoint, so LibreChat can talk to the
// org's data as a custom endpoint (librechat.yaml snippet in the README).
// "Who's drifting?" → live ClickHouse trajectory query, names back in seconds.
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
  } else {
    answer =
      `I answer from the org's hour ledger. Try: "Who's drifting?" — ` +
      `I'll rank people whose hard hours are climbing month over month while their attendance stays flat.`;
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
