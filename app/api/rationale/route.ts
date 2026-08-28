import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";

// Claude-written match rationale — why this person, in coordinator language.
// Uses the local authenticated `claude` CLI headless; falls back to a
// deterministic template so the demo never blocks on a model call.
function claudeP(prompt: string, timeoutMs = 20000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "claude",
      ["-p", prompt, "--output-format", "text", "--model", "haiku"],
      { timeout: timeoutMs, maxBuffer: 1024 * 1024 },
      (err, stdout) => (err ? reject(err) : resolve(stdout.trim())),
    );
  });
}

export async function POST(req: NextRequest) {
  const b = await req.json();
  const { person, candidate, slot } = b;

  const fallback =
    `${candidate.name} has shown up to ${candidate.attended} of their last ` +
    `${candidate.attended + candidate.no_shows} matched hours and their declared surplus ` +
    `already covers this slot. Close by, and meetings of this shape usually hold. ` +
    `A higher-overlap match exists, but overlap doesn't open the door — showing up does.`;

  try {
    const text = await claudeP(
      `You write one short rationale for a community coordinator routing social hours.
Person in need: ${person.name}, whose declared "hard hours" have been climbing month over month while their attendance stayed steady.
Proposed slot: ${slot}.
Candidate: ${candidate.name} — attended ${candidate.attended} of ${candidate.attended + candidate.no_shows} matched hours; temporal overlap ${candidate.temporal_overlap}; proximity factor ${candidate.proximity_decay} (higher = closer); historical fulfillment for meetings of this shape ${candidate.shape_fulfillment}.
Write 2 sentences, warm but factual, no exclamation marks, no emoji, explaining why this candidate over a flashier one. Output only the sentences.`,
    );
    return NextResponse.json({ rationale: text || fallback, source: "claude" });
  } catch {
    return NextResponse.json({ rationale: fallback, source: "fallback" });
  }
}
