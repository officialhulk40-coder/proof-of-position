import type { CallView } from "@pop/core/browser";
import { useCallback, useEffect, useRef, useState } from "react";
import type { TokenDto } from "../api/client";
import type { Flip } from "../chain/diff";
import { companyName } from "../format";

const WATCH_KEY = "pop.watched.v1";

type KeyValueStore = Pick<Storage, "getItem" | "setItem">;

/** localStorage, or null where it is blocked (private mode, sandboxed iframes). */
export function safeStorage(): KeyValueStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadWatched(storage: KeyValueStore | null): Set<number> {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(WATCH_KEY) ?? "[]");
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is number => Number.isInteger(id) && id >= 0) : []);
  } catch {
    return new Set();
  }
}

export function saveWatched(storage: KeyValueStore | null, ids: ReadonlySet<number>): void {
  try {
    storage?.setItem(WATCH_KEY, JSON.stringify([...ids].sort((a, b) => a - b)));
  } catch {
    // storage full or blocked: alerts still work for this tab
  }
}

/** Watched call ids, persisted per browser. Watching asks for Notification permission once. */
export function useWatched(storage: KeyValueStore | null = safeStorage()): { watched: ReadonlySet<number>; toggle: (callId: number) => void } {
  const [watched, setWatched] = useState<ReadonlySet<number>>(() => loadWatched(storage));
  const toggle = useCallback(
    (callId: number) => {
      setWatched((current) => {
        const next = new Set(current);
        if (next.has(callId)) next.delete(callId);
        else next.add(callId);
        saveWatched(storage, next);
        return next;
      });
      if (typeof Notification !== "undefined" && Notification.permission === "default") void Notification.requestPermission();
    },
    [storage],
  );
  return { watched, toggle };
}

export function flipMessage(flip: Flip, call: CallView | undefined, token: TokenDto | undefined): string {
  const subject = `Call #${flip.callId} · ${companyName(token)}`;
  switch (flip.kind) {
    case "exited":
      return `${subject}: the caller exited. Badge is now EXITED.`;
    case "trimmed":
      return `${subject}: the caller trimmed below the declared size.`;
    case "closed":
      return `${subject}: closed by the caller${call?.heldThrough ? " · held through ✓" : " · exited while open"}.`;
    case "exit-recorded":
      return `${subject}: exit recorded on-chain at block ${call?.exitBlock.toString() ?? "?"}.`;
  }
}

export function notify(title: string, body: string): void {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body });
  } catch {
    // some mobile browsers only allow notifications from a service worker
  }
}

export interface Toast {
  id: number;
  text: string;
  tone: "info" | "bad";
}

/** In-page toasts that dismiss themselves after `ttlMs`. */
export function useToasts(ttlMs = 8_000): { toasts: Toast[]; push: (text: string, tone?: Toast["tone"]) => void; dismiss: (id: number) => void } {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const dismiss = useCallback((id: number) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);
  const push = useCallback(
    (text: string, tone: Toast["tone"] = "info") => {
      nextId.current += 1;
      const id = nextId.current;
      setToasts((current) => [...current.slice(-4), { id, text, tone }]);
      const timer = setTimeout(() => {
        timers.current.delete(timer);
        dismiss(id);
      }, ttlMs);
      timers.current.add(timer);
    },
    [dismiss, ttlMs],
  );
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => clearTimeout(timer));
  }, []);
  return { toasts, push, dismiss };
}
