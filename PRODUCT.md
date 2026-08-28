# Coincide — product context

*(Inferred from SURPLUS_BUILD.md, the hackathon build brief; user directed proceed-without-interview.)*

## What it is
Coincide is a routing system for social hours. People declare **time** (surplus hours they have,
deficit hours that are hard), not identity. Coordinators at verified orgs (senior
centers, campuses, neighborhoods) see the gap between surplus and deficit hours and
route one person an hour with a ranked, legible matching score. Thesis: **we are not
matching people, we are routing hours.**

## Users & scene
- **Primary:** an org coordinator at a desk, mid-morning, scanning for people whose
  need is climbing. Operate mode — scanability first, brand in the details.
- **Secondary:** members (Margaret, Ray personas) who accept a proposed hour.
- **Audience-of-record:** hackathon judges — ClickHouse engineers. Rows-scanned and
  query-latency readouts are always visible; they are product truth, not chrome.

## Stack & constraints
- Next.js (App Router, TS), raw SQL, no ORM, no auth (three personas + switcher),
  no mobile view, no tests. Postgres = current truth; ClickHouse = 50M-event history.
- Demo is 3 minutes, one narrative: freight map → Margaret drifting → route to Ray →
  two-sided accept → latency close.

## Visual world (from brief §6)
- The **freight map** is the product image: surplus vs deficit density, org ×
  weekday × 30-min band; the unmet gap must be the first thing the eye lands on.
- Restrained palette; real typographic hierarchy; generous whitespace. No purple
  gradient, no glassmorphism, no emoji in UI. Motion only where it explains
  (hours routing surplus → deficit). Empty, clearly-marked hero media slot on the
  public page (photos shot on the day). Rows scanned + elapsed ms always visible.
