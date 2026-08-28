"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const fmtMin = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
const avatar = (seed: string) =>
  `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(seed)}&backgroundColor=f6f3ec`;

type Filter = "all" | "people" | "activities";

// The main page: night-mode world map. Fly in from orbit, find the avatars
// of people out and about, click one for who they actually are.
export default function MapPage() {
  const mapRef = useRef<any>(null);
  const actMarkersRef = useRef<any[]>([]);
  const liveMarkersRef = useRef<any[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [counts, setCounts] = useState({ people: 0, acts: 0, live: 0, free: 0, hard: 0 });
  const [topOrgs, setTopOrgs] = useState<[string, number][]>([]);
  const [me, setMe] = useState<{ id: number; name: string } | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const join = useCallback(
    async (id: number, title: string) => {
      if (!me) {
        setNote("Join Coincide first, then you can jump into plans.");
        return;
      }
      const res = await fetch(`/api/activities/${id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: me.id }),
      });
      const d = await res.json();
      setNote(res.ok ? `You're in for “${title}”.` : d.error);
    },
    [me],
  );
  const joinRef = useRef(join);
  joinRef.current = join;

  useEffect(() => {
    const raw = localStorage.getItem("coincide_user");
    if (raw) setMe(JSON.parse(raw));
  }, []);

  useEffect(() => {
    let disposed = false;
    let map: any;
    (async () => {
      if (disposed) return;
      try {
        map = new maplibregl.Map({
          container: "worldmap",
          style: "https://tiles.openfreemap.org/styles/positron",
          center: [10, 22],
          zoom: 1.6,
          attributionControl: false,
        });
        mapRef.current = map;
        // the 3D world: globe projection, drifting in space until we descend
        map.on("style.load", () => {
          map.setProjection({ type: "globe" });
        });
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

        const d = await fetch("/api/mappoints").then((r) => r.json());
        if (disposed) return;

        map.on("load", () => {
          // everyone, as glowing dots
          map.addSource("people", {
            type: "geojson",
            data: {
              type: "FeatureCollection",
              features: d.people.map((p: any) => ({
                type: "Feature",
                geometry: { type: "Point", coordinates: [p.lng, p.lat] },
                properties: {
                  name: p.name,
                  org: p.org,
                  free: p.windows.some((w: any) => w.kind === "surplus") ? 1 : 0,
                  windows: JSON.stringify(p.windows.slice(0, 4)),
                },
              })),
            },
          });
          map.addLayer({
            id: "people",
            type: "circle",
            source: "people",
            paint: {
              "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 1.6, 10, 3.2, 14, 6],
              "circle-color": ["case", ["==", ["get", "free"], 1], "#e0973f", "#7fa8d4"],
              "circle-stroke-width": 1,
              "circle-stroke-color": "rgba(255,255,255,0.55)",
              "circle-opacity": 0.85,
            },
          });
          map.on("click", "people", (e: any) => {
            const f = e.features[0];
            const wins = JSON.parse(f.properties.windows)
              .map(
                (w: any) =>
                  `<li>${DAYS[w.weekday]} ${fmtMin(w.start_min)}–${fmtMin(w.end_min)} · ${
                    w.kind === "surplus" ? "free" : "wants company"
                  }</li>`,
              )
              .join("");
            new maplibregl.Popup({ offset: 10 })
              .setLngLat(f.geometry.coordinates)
              .setHTML(
                `<div class="pop"><b>${f.properties.name}</b><span>${f.properties.org}</span>
                 <ul>${wins || "<li>No hours listed yet</li>"}</ul></div>`,
              )
              .addTo(map);
          });
          map.on("mouseenter", "people", () => (map.getCanvas().style.cursor = "pointer"));
          map.on("mouseleave", "people", () => (map.getCanvas().style.cursor = ""));

          // activities as star pins
          actMarkersRef.current = d.activities.map((a: any) => {
            const el = document.createElement("div");
            el.className = "actPin";
            el.innerHTML = "<span>★</span>";
            const pop = document.createElement("div");
            pop.className = "pop";
            pop.innerHTML = `<b>${a.title}</b><span>${fmtWhen(a.starts_at)} · ${a.place_label}</span>
              <span>Hosted by ${a.host_name} · ${a.joined}/${a.capacity} going</span>`;
            const btn = document.createElement("button");
            btn.textContent = a.joined >= a.capacity ? "Full up" : "Count me in";
            btn.disabled = a.joined >= a.capacity;
            btn.onclick = () => joinRef.current(a.id, a.title);
            pop.appendChild(btn);
            return new maplibregl.Marker({ element: el })
              .setLngLat([a.lng, a.lat])
              .setPopup(new maplibregl.Popup({ offset: 16 }).setDOMContent(pop))
              .addTo(map);
          });

          // a handful of people "out and about now": avatar bubbles that pulse
          const live = d.people.filter((_: any, i: number) => i % 167 === 3).slice(0, 14);
          liveMarkersRef.current = live.map((p: any) => {
            const el = document.createElement("div");
            el.className = "liveAvatar";
            el.innerHTML = `<i></i><img src="${avatar(p.name)}" alt="" width="44" height="44" />`;
            el.onclick = async (ev) => {
              ev.stopPropagation();
              const prof = await fetch(`/api/profile?user_id=${p.id}`).then((r) => r.json());
              const total = prof.attended + prof.no_shows;
              const since = prof.first_seen
                ? new Date(prof.first_seen).toLocaleString("en-US", { month: "long", year: "numeric" })
                : null;
              const wins = prof.windows
                .map(
                  (w: any) =>
                    `<li>${DAYS[w.weekday]} ${fmtMin(w.start_min)}–${fmtMin(w.end_min)} · ${
                      w.kind === "surplus" ? "free" : "wants company"
                    }</li>`,
                )
                .join("");
              new maplibregl.Popup({ offset: 26, maxWidth: "300px" })
                .setLngLat([p.lng, p.lat])
                .setHTML(
                  `<div class="pop profileCard">
                     <img src="${avatar(p.name)}" alt="" width="52" height="52" />
                     <b>${prof.name}</b>
                     <span>${prof.org}</span>
                     ${total ? `<span class="popStat">Showed up ${prof.attended} of ${total} plans</span>` : ""}
                     ${since ? `<span>Around since ${since}</span>` : ""}
                     <ul>${wins || "<li>No hours listed yet</li>"}</ul>
                     <span class="popScan">${prof.events.toLocaleString()} moments of history · ${prof.scan_ms} ms</span>
                   </div>`,
                )
                .addTo(map);
            };
            return new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map);
          });

          // panel numbers
          const orgCount = new Map<string, number>();
          let free = 0;
          for (const p of d.people) {
            orgCount.set(p.org, (orgCount.get(p.org) ?? 0) + 1);
            if (p.windows.some((w: any) => w.kind === "surplus")) free++;
          }
          setTopOrgs([...orgCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3));
          setCounts({
            people: d.people.length,
            acts: d.activities.length,
            live: live.length,
            free,
            hard: d.people.length - free,
          });

          // the arrival: spin the globe toward the west coast, then descend
          setTimeout(() => {
            map.easeTo({ center: [-100, 32], zoom: 2.1, duration: 2600, essential: true });
          }, 700);
          setTimeout(() => {
            map.flyTo({
              center: [-122.43, 37.7852],
              zoom: 12.6,
              duration: 6500,
              curve: 1.55,
              essential: true,
            });
          }, 3500);
        });
        map.on("error", () => {});
      } catch (err: any) {
        setNote(`map failed: ${err?.message ?? err}`);
      }
    })();
    return () => {
      disposed = true;
      mapRef.current?.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer?.("people")) return;
    map.setLayoutProperty("people", "visibility", filter === "activities" ? "none" : "visible");
    for (const m of actMarkersRef.current)
      m.getElement().style.display = filter === "people" ? "none" : "grid";
    for (const m of liveMarkersRef.current)
      m.getElement().style.display = filter === "activities" ? "none" : "block";
  }, [filter, counts]);

  return (
    <div className="mapShell dark">
      <div id="worldmap" />
      <header className="mapBar">
        <Link href="/map" className="chrome-mark display">Coincide</Link>
        <nav className="mapFilters" aria-label="Show on map">
          {(["all", "people", "activities"] as Filter[]).map((f) => (
            <button
              key={f}
              className={`slotChip${filter === f ? " active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "Everything" : f === "people" ? `People (${counts.people})` : `Activities (${counts.acts})`}
            </button>
          ))}
        </nav>
        <nav className="mapLinks">
          <Link href="/activities" className="chrome-persona">Board</Link>
          <Link href="/welcome" className="chrome-persona">About</Link>
          {me ? (
            <span className="chrome-persona active">{me.name.split(" ")[0]}</span>
          ) : (
            <Link href="/join" className="chrome-persona active">Join</Link>
          )}
        </nav>
      </header>

      {counts.live > 0 && (
        <aside className="livePanel">
          <div className="liveTitle">
            <i className="liveDot" /> {counts.live} out and about right now
          </div>
          <div className="liveRow">
            <span>Centers</span>
            <span>
              {topOrgs.map(([name, n]) => (
                <em key={name}>{name.replace(/ #\d+$/, "")} ({n})</em>
              ))}
            </span>
          </div>
          <div className="liveRow">
            <span>Hours</span>
            <span>
              <em className="chipFree">{counts.free} free</em>
              <em className="chipHardTag">{counts.hard} want company</em>
            </span>
          </div>
          <div className="liveRow">
            <span>Plans</span>
            <span><em>{counts.acts} on the board</em></span>
          </div>
        </aside>
      )}

      {note && (
        <div className="mapNote" role="status" onClick={() => setNote(null)}>
          {note}
        </div>
      )}
    </div>
  );
}
