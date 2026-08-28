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

type Filter = "all" | "people" | "activities";

// The main page: a real map you can wander. People and their listed hours,
// activities you can join, right where they are. Vector tiles, no key.
export default function MapPage() {
  const mapRef = useRef<any>(null);
  const actMarkersRef = useRef<any[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [counts, setCounts] = useState({ people: 0, acts: 0 });
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
    let map: any;
    let disposed = false;
    (async () => {
      if (disposed) return;
      try {
      map = new maplibregl.Map({
        container: "worldmap",
        style: "https://tiles.openfreemap.org/styles/positron",
        center: [-122.43, 37.7852],
        zoom: 12.4,
        attributionControl: false,
      });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

      const d = await fetch("/api/mappoints").then((r) => r.json());
      if (disposed) return;

      map.on("load", () => {
        map.addSource("people", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: d.people.map((p: any) => ({
              type: "Feature",
              geometry: { type: "Point", coordinates: [p.lng, p.lat] },
              properties: {
                id: p.id,
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
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 3, 14, 6.5],
            "circle-color": ["case", ["==", ["get", "free"], 1], "#c07a2b", "#2e4a68"],
            "circle-stroke-width": 1.4,
            "circle-stroke-color": "#fdfbf7",
            "circle-opacity": 0.88,
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

        setCounts({ people: d.people.length, acts: d.activities.length });
      });
      map.on("error", (e: any) => setNote(`map error: ${e?.error?.message ?? e}`));
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
    for (const m of actMarkersRef.current) {
      m.getElement().style.display = filter === "people" ? "none" : "grid";
    }
  }, [filter, counts]);

  return (
    <div className="mapShell">
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
      {note && (
        <div className="mapNote" role="status" onClick={() => setNote(null)}>
          {note}
        </div>
      )}
    </div>
  );
}
