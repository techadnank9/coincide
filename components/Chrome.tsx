"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

export interface QueryStats {
  rows_read: number;
  elapsed_ms: number;
}

// Three hardcoded personas, no auth — spec §10.
export const PERSONAS = [
  { label: "Coordinator", href: "/coordinator" },
  { label: "Margaret", href: "/me?as=1" },
  { label: "Ray", href: "/me?as=41" },
];

function Nav() {
  const path = usePathname();
  const qs = useSearchParams();
  const as = qs.get("as");
  return (
    <nav className="chrome-nav" aria-label="Persona switcher">
      {PERSONAS.map((p) => {
        const active =
          p.href === "/coordinator"
            ? path === "/coordinator"
            : path === "/me" && p.href.endsWith(`as=${as}`);
        return (
          <Link key={p.label} href={p.href} className={`chrome-persona${active ? " active" : ""}`}>
            {p.label}
          </Link>
        );
      })}
      <Link href="/join" className={`chrome-persona${path === "/join" ? " active" : ""}`}>
        Join
      </Link>
    </nav>
  );
}

// rows scanned + latency always visible — spec §6. ClickHouse's own numbers.
export function StatsReadout({ stats }: { stats: QueryStats | null }) {
  if (!stats) return <span className="chrome-stats mono">ClickHouse · warming</span>;
  return (
    <span className="chrome-stats mono" aria-live="polite">
      {stats.rows_read.toLocaleString()} rows · {stats.elapsed_ms} ms
    </span>
  );
}

export default function Chrome({
  stats,
  tagline = true,
}: {
  stats?: QueryStats | null;
  tagline?: boolean;
}) {
  return (
    <header className="chrome">
      <Link href="/" className="chrome-mark display">
        Coincide
      </Link>
      <span className="chrome-thesis">
        {tagline ? "Where free hours meet hard ones." : ""}
      </span>
      <Suspense>
        <Nav />
      </Suspense>
      {stats !== undefined && <StatsReadout stats={stats} />}
    </header>
  );
}
