import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { StreamPlayback } from "./types";
import "./PortalVideoPanel.css";

export function PortalVideoPanel() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playback, setPlayback] = useState<StreamPlayback | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [nativeHls, setNativeHls] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setPlayback(null);
    setError("");
    api<StreamPlayback>("/api/stream/token", {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((result) => setPlayback(result))
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error ? cause.message : "Secure stream unavailable",
          );
      });
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    if (!playback) return;
    const probe = document.createElement("video");
    setNativeHls(
      Boolean(probe.canPlayType("application/vnd.apple.mpegurl")),
    );
    // Refresh before this short-lived bearer playback URL expires.
    const timer = window.setTimeout(
      () => setAttempt((value) => value + 1),
      4 * 60 * 1000,
    );
    return () => window.clearTimeout(timer);
  }, [playback]);

  return (
    <section className="portal-video" aria-label="Restricted live stream">
      <header className="portal-video__header">
        <span>LIVE TELEMETRY FEED</span>
        <span className="portal-video__badge">STAFF ACCESS</span>
      </header>
      {error ? (
        <div className="portal-video__message" role="alert">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Retry secure feed
          </button>
        </div>
      ) : !playback ? (
        <div className="portal-video__message" role="status">
          Requesting restricted playback…
        </div>
      ) : nativeHls ? (
        <video
          key={playback.playbackUrl}
          ref={videoRef}
          className="portal-video__media"
          src={playback.playbackUrl}
          autoPlay
          muted
          playsInline
          controls
          onError={() =>
            setError("Stream playback failed or is unavailable on this connection.")
          }
        />
      ) : (
        <iframe
          key={playback.playerUrl}
          className="portal-video__media"
          src={playback.playerUrl}
          title="Restricted Cloudflare Stream playback"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          referrerPolicy="no-referrer"
        />
      )}
      {playback && (
        <small className="portal-video__expiry">
          Playback access expires at {new Date(playback.expiresAt).toLocaleTimeString()}.
        </small>
      )}
    </section>
  );
}
