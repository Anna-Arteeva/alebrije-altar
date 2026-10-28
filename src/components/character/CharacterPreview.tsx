"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import type { CharacterView, SceneStatus } from "@/lib/character/scene";
import "./character.css";

const CharacterCanvas = dynamic(() => import("./CharacterCanvas"), {
  ssr: false,
  loading: () => <div className="character-loading" role="status">Opening the studio…</div>,
});
const views: { id: CharacterView; label: string }[] = [
  { id: "portrait", label: "Three-quarter" }, { id: "front", label: "Front" },
  { id: "left", label: "Left" }, { id: "right", label: "Right" }, { id: "back", label: "Back" },
];
function subscribeMotion(callback: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

export function CharacterPreview() {
  const [view, setView] = useState<CharacterView>("portrait");
  const [revision, setRevision] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reference, setReference] = useState(false);
  const [sceneStatus, setSceneStatus] = useState<SceneStatus>("loading");
  const [zoomCommand, setZoomCommand] = useState<{ direction: "in" | "out"; revision: number }>();
  const reduced = useSyncExternalStore(subscribeMotion, () => window.matchMedia("(prefers-reduced-motion: reduce)").matches, () => false);
  function changeView(next: CharacterView) { setView(next); setRevision((v) => v + 1); }

  return (
    <main className="character-studio">
      <header className="character-header">
        <Link href="/" className="character-wordmark">Alebrije <span>Altar</span></Link>
        <span className="character-edition">Character study <span>№ 01</span></span>
      </header>
      <section className="character-intro">
        <p className="character-eyebrow">A little wonder, taking shape</p>
        <h1>Meet your alebrije.</h1>
        <p>A gentle soul. A coat of flowers. A little bird in its bones.</p>
      </section>
      <section className="character-stage" aria-label="Interactive character preview">
        <div className="character-stageNote"><span className="character-dot" /> Inspired by painted folk art.</div>
        <CharacterCanvas animated={!paused} view={view} viewRevision={revision} zoomCommand={zoomCommand} onStatusChange={setSceneStatus} />
        <button type="button" className="character-referenceToggle" aria-expanded={reference} onClick={() => setReference((v) => !v)}>
          {reference ? "Hide reference" : "Original illustration"}<span aria-hidden>{reference ? " −" : " ↗"}</span>
        </button>
        {reference && (
          <figure className="character-reference">
            {/* eslint-disable-next-line @next/next/no-img-element -- local source artwork for visual comparison */}
            <img src="/character/reference.webp" alt="Original character illustration used to build this model" />
            <figcaption>The starting point</figcaption>
          </figure>
        )}
        {sceneStatus === "ready" && <p className="character-gesture">Drag to turn <span>·</span> Scroll or pinch to look closer</p>}
      </section>
      <div className="character-toolbar">
        <div className="character-views" role="group" aria-label="Character view">
          {views.map((item) => <button key={item.id} type="button" disabled={sceneStatus !== "ready"} aria-pressed={view === item.id} onClick={() => changeView(item.id)}>{item.label}</button>)}
        </div>
        <div className="character-actions" role="group" aria-label="Preview controls">
          <button type="button" disabled={sceneStatus !== "ready"} aria-label="Zoom in" onClick={() => setZoomCommand((v) => ({ direction: "in", revision: (v?.revision ?? 0) + 1 }))}>+</button>
          <button type="button" disabled={sceneStatus !== "ready"} aria-label="Zoom out" onClick={() => setZoomCommand((v) => ({ direction: "out", revision: (v?.revision ?? 0) + 1 }))}>−</button>
          <button type="button" disabled={sceneStatus !== "ready"} onClick={() => changeView("portrait")}>Reset</button>
          <button type="button" disabled={reduced || sceneStatus !== "ready"} aria-pressed={paused || reduced} onClick={() => setPaused((v) => !v)}>{reduced ? "Motion reduced" : paused ? "Play motion" : "Pause motion"}</button>
        </div>
      </div>
      <footer className="character-footer">
        <p><span className="character-swatches" aria-hidden><i /><i /><i /><i /></span>Marigold, agave & warm ivory</p>
        <p>A character in progress. A companion to come.</p>
      </footer>
    </main>
  );
}
