import { parseSpatialFrame, spatialSocketUrl, type SpatialFrame } from "./protocol";

export type SpatialConnectionState = "connecting" | "connected" | "disconnected" | "unauthorized";

export interface WSManagerOptions {
  url: string;
  pageUrl: string;
  token: string;
  peerId: string;
  onOpen?: () => void;
  onMessage?: (data: SpatialFrame) => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  onStatus?: (state: SpatialConnectionState) => void;
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  stableResetMs?: number;
}

/** Authenticates using the existing post-connect auth frame; never leaks tokens in URLs. */
export class SpatialWSManager {
  private ws: WebSocket | null = null;
  private retryCount = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stableTimer: ReturnType<typeof setTimeout> | null = null;
  private authTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;
  private authenticated = false;
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly stableResetMs: number;
  private readonly socketUrl: string;
  private readonly token: string;
  private readonly peerId: string;

  constructor(private readonly options: WSManagerOptions) {
    this.socketUrl = spatialSocketUrl(options.url, options.pageUrl);
    this.token = options.token;
    this.peerId = options.peerId;
    this.maxRetries = options.maxRetries ?? 8;
    this.baseDelayMs = options.baseDelayMs ?? 500;
    this.maxDelayMs = options.maxDelayMs ?? 15_000;
    this.stableResetMs = options.stableResetMs ?? 10_000;
  }

  connect() {
    if (this.intentionalClose || !this.token) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    this.options.onStatus?.("connecting");
    try {
      const socket = new WebSocket(this.socketUrl);
      this.ws = socket;
      socket.onopen = () => {
        if (this.ws !== socket || this.intentionalClose) return;
        socket.send(JSON.stringify({ type: "auth", token: this.token, peerId: this.peerId }));
        this.options.onOpen?.();
        this.authTimer = setTimeout(() => {
          if (this.ws === socket && !this.authenticated) socket.close(1008, "Authentication timeout");
        }, 8_000);
      };
      socket.onmessage = (event) => {
        if (typeof event.data !== "string") return;
        const frame = parseSpatialFrame(event.data);
        if (!frame) return;
        if (frame.type === "ready") {
          this.authenticated = true;
          this.clearAuthTimer();
          this.options.onStatus?.("connected");
          this.clearStableTimer();
          this.stableTimer = setTimeout(() => { this.retryCount = 0; }, this.stableResetMs);
        }
        this.options.onMessage?.(frame);
      };
      socket.onerror = (error) => this.options.onError?.(error);
      socket.onclose = (event) => {
        if (this.ws === socket) this.ws = null;
        this.authenticated = false;
        this.clearAuthTimer();
        this.clearStableTimer();
        this.options.onClose?.();
        if (this.intentionalClose) return;
        if (event.code === 1008 && /invalid credentials|authentication required/i.test(event.reason)) {
          this.options.onStatus?.("unauthorized");
          return;
        }
        this.scheduleReconnect();
      };
    } catch (error) {
      this.options.onError?.(new Event(error instanceof Error ? error.message : "WebSocket connection failed"));
      this.scheduleReconnect();
    }
  }

  sendPosition(position: { x: number; y: number; mode: string }) {
    if (!this.authenticated || this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(position));
  }

  disconnect() {
    this.intentionalClose = true;
    this.clearReconnectTimer();
    this.clearStableTimer();
    this.clearAuthTimer();
    const socket = this.ws;
    this.ws = null;
    this.authenticated = false;
    socket?.close(1000, "HUD closed");
  }

  private scheduleReconnect() {
    if (this.intentionalClose) return;
    if (this.retryCount >= this.maxRetries) {
      this.options.onStatus?.("disconnected");
      return;
    }
    const ceiling = Math.min(this.maxDelayMs, this.baseDelayMs * 2 ** this.retryCount);
    const delay = Math.random() * ceiling;
    this.retryCount++;
    this.options.onStatus?.("connecting");
    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }
  private clearStableTimer() {
    if (this.stableTimer) clearTimeout(this.stableTimer);
    this.stableTimer = null;
  }
  private clearAuthTimer() {
    if (this.authTimer) clearTimeout(this.authTimer);
    this.authTimer = null;
  }
}
