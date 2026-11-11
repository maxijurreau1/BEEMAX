import { useCallback, useEffect, useRef, useState } from "react";
import { API_URL } from "../api/client";
import { useGovernor } from "../layouts/GovernorLayout";
import { Canvas2DHUDRenderer, WebGLHUDRenderer, type HUDRenderer } from "../spatial/renderers";
import { SpatialWSManager, type SpatialConnectionState } from "../spatial/SpatialWSManager";
import type { SpatialCursor, SpatialFrame } from "../spatial/protocol";
import { PortalVideoPanel } from "../stream/PortalVideoPanel";

export const SpatialHUDPage: React.FC = () => {
  const { token: sessionToken } = useGovernor();
  const webglCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fallbackCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<HUDRenderer | null>(null);
  const peersRef = useRef(new Map<string, SpatialCursor>());
  const managerRef = useRef<SpatialWSManager | null>(null);
  const [activeMode, setActiveMode] = useState("PATH-B GRID // STABLE");
  const [resonanceActive, setResonanceActive] = useState(true);
  const [connection, setConnection] = useState<SpatialConnectionState>("connecting");
  const [rendererMode, setRendererMode] = useState<"webgl" | "2d">("2d");
  const modeRef = useRef(activeMode);
  modeRef.current = activeMode;

  const applyFrame = useCallback((frame: SpatialFrame) => {
    if (frame.type === "peer") {
      peersRef.current.set(frame.id, frame);
      rendererRef.current?.update(frame);
    } else if (frame.type === "leave") {
      peersRef.current.delete(frame.id);
      rendererRef.current?.remove(frame.id);
    }
  }, []);

  useEffect(() => {
    const webglCanvas = webglCanvasRef.current;
    const fallbackCanvas = fallbackCanvasRef.current;
    if (!webglCanvas || !fallbackCanvas) return;

    let disposed = false;
    let active: HUDRenderer | null = null;
    let fallback: Canvas2DHUDRenderer | null = null;

    const size = () => {
      const ratio = window.devicePixelRatio || 1;
      active?.resize(window.innerWidth, window.innerHeight, ratio);
      fallback?.resize(window.innerWidth, window.innerHeight, ratio);
    };

    const activateFallback = () => {
      if (disposed || active instanceof Canvas2DHUDRenderer) return;
      active?.dispose();
      fallback ??= new Canvas2DHUDRenderer(fallbackCanvas);
      try {
        fallback.initialize();
        for (const peer of peersRef.current.values()) fallback.update(peer);
        active = fallback;
        rendererRef.current = fallback;
        size();
        setRendererMode("2d");
      } catch (error) {
        console.error("HUD 2D fallback unavailable", error);
      }
    };

    const activateWebGL = () => {
      if (disposed) return;
      const renderer = new WebGLHUDRenderer(webglCanvas);
      try {
        renderer.initialize();
        for (const peer of peersRef.current.values()) renderer.update(peer);
        fallback?.dispose();
        fallback = null;
        active?.dispose();
        active = renderer;
        rendererRef.current = renderer;
        size();
        setRendererMode("webgl");
      } catch (error) {
        renderer.dispose();
        console.info("HUD using 2D fallback", error);
        activateFallback();
      }
    };

    const onContextLost = (event: Event) => {
      event.preventDefault();
      activateFallback();
    };

    const onContextRestored = () => activateWebGL();

    webglCanvas.addEventListener("webglcontextlost", onContextLost);
    webglCanvas.addEventListener("webglcontextrestored", onContextRestored);
    window.addEventListener("resize", size);
    activateWebGL();
    if (!active) activateFallback();

    return () => {
      disposed = true;
      window.removeEventListener("resize", size);
      webglCanvas.removeEventListener("webglcontextlost", onContextLost);
      webglCanvas.removeEventListener("webglcontextrestored", onContextRestored);
      active?.dispose();
      if (fallback && fallback !== active) fallback.dispose();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!sessionToken) {
      setConnection("unauthorized");
      return;
    }

    const manager = new SpatialWSManager({
      url: API_URL,
      pageUrl: window.location.href,
      token: sessionToken,
      peerId: `hud-${crypto.randomUUID()}`,
      onMessage: applyFrame,
      onStatus: setConnection,
    });

    managerRef.current = manager;
    manager.connect();

    const interval = window.setInterval(() => {
      manager.sendPosition({
        x: Math.min(1, Math.max(0, 0.5 + Math.sin(Date.now() / 1500) * 0.3)),
        y: Math.min(1, Math.max(0, 0.5 + Math.cos(Date.now() / 2100) * 0.25)),
        mode: modeRef.current,
      });
    }, 500);

    return () => {
      window.clearInterval(interval);
      manager.disconnect();
      managerRef.current = null;
    };
  }, [sessionToken, applyFrame]);

  const selectMode = (mode: string) => () => setActiveMode(mode);
  const statusLabel =
    connection === "connected"
      ? "ENTITY: ONLINE"
      : connection === "unauthorized"
        ? "ENTITY: AUTH REQUIRED"
        : connection === "disconnected"
          ? "ENTITY: OFFLINE"
          : "ENTITY: CONNECTING";

  return (
    <main className="spatial-hud" aria-label="Portal spatial HUD">
      <canvas
        ref={webglCanvasRef}
        className={`spatial-hud__canvas spatial-hud__webgl ${rendererMode === "webgl" ? "is-visible" : ""}`}
        aria-hidden="true"
      />
      <canvas
        ref={fallbackCanvasRef}
        className={`spatial-hud__canvas spatial-hud__fallback ${rendererMode === "2d" ? "is-visible" : ""}`}
        aria-hidden="true"
      />
      <div className="spatial-hud__overlay">
        <header className="spatial-hud__header">
          <h1>PORTAL-OS1 // SPATIAL HUD</h1>
          <div className="spatial-hud__status" aria-live="polite">
            <span>{statusLabel}</span>
            <small>RENDERER: {rendererMode === "webgl" ? "WEBGL" : "2D FALLBACK"}</small>
          </div>
        </header>

        <aside className="spatial-hud__panel" aria-label="Simulation nodes">
          <h2>SIMULATION // NODES</h2>
          <button onClick={selectMode("PATH-B Sector 01 Active")}>PATH-B Sector 01 <small>1Hz deterministic simulation</small></button>
          <button onClick={selectMode("MAX Chess Platform Active")}>MAX Chess Platform <small>Chess engine</small></button>
          <button onClick={selectMode("Quantum Sports Grid Active")}>Quantum Sports Grid <small>Telemetry integration pending</small></button>
        </aside>

        <section className="spatial-hud__center">
          <p>CORE MODE: <strong>{activeMode}</strong></p>
          <button aria-pressed={resonanceActive} onClick={() => setResonanceActive((value) => !value)}>Toggle Entity Pulse</button>
          <small>{peersRef.current.size} connected peer(s)</small>
        </section>

        <aside className="spatial-hud__panel spatial-hud__media" aria-label="Media archive">
          <h2>MEDIA // ARCHIVES</h2>
          <PortalVideoPanel />
        </aside>
      </div>
    </main>
  );
};
