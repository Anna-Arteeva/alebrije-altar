"use client";

import { useEffect, useEffectEvent, useRef, useState, type CSSProperties } from "react";
import { createCharacterScene, type CharacterScene, type CharacterView, type SceneStatus } from "@/lib/character/scene";
import "./character.css";

export interface CharacterCanvasProps {
  className?: string;
  style?: CSSProperties;
  animated?: boolean;
  interactive?: boolean;
  view?: CharacterView;
  viewRevision?: number;
  zoomCommand?: { direction: "in" | "out"; revision: number };
  onStatusChange?: (status: SceneStatus) => void;
}

export default function CharacterCanvas({ className, style, animated = true, interactive = true, view = "portrait", viewRevision = 0, zoomCommand, onStatusChange }: CharacterCanvasProps) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<CharacterScene | null>(null);
  const [status, setStatus] = useState<SceneStatus>("loading");
  const reportStatus = useEffectEvent((next: SceneStatus) => {
    setStatus(next);
    onStatusChange?.(next);
  });

  useEffect(() => {
    if (!host.current) return;
    let active = true;
    try {
      scene.current = createCharacterScene(host.current, { animated: true, interactive: true, onStatus: (next) => { if (active) reportStatus(next); } });
    } catch (error) {
      console.error("WebGL is unavailable", error);
      // Defer the status notification just as the texture-loading path does.
      queueMicrotask(() => { if (active) reportStatus("error"); });
    }
    return () => { active = false; scene.current?.dispose(); scene.current = null; };
  }, []);
  useEffect(() => { scene.current?.setAnimated(animated); }, [animated]);
  useEffect(() => { scene.current?.setInteractive(interactive); }, [interactive]);
  useEffect(() => { scene.current?.setView(view); }, [view, viewRevision]);
  useEffect(() => { if (zoomCommand) scene.current?.zoom(zoomCommand.direction === "in" ? 0.85 : 1.18); }, [zoomCommand]);

  return (
    <div className={`character-canvasShell ${className ?? ""}`} style={style} data-scene-status={status}>
      <div ref={host} className="character-canvas" style={{ visibility: status === "ready" ? "visible" : "hidden" }} />
      {status !== "ready" && (
        <div className="character-fallback">
          {/* eslint-disable-next-line @next/next/no-img-element -- also works when WebGL is unavailable */}
          <img src="/character/reference.webp" alt="Painted cream alpaca alebrije with orange and teal wings, floral markings, and long bird legs" />
          <p role="status">{status === "loading" ? "Bringing the character into view…" : "3D is unavailable here. You can still enjoy the original illustration."}</p>
        </div>
      )}
    </div>
  );
}
