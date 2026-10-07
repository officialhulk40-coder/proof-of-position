import { useSyncExternalStore } from "react";

export type Route =
  | { name: "feed" }
  | { name: "call"; id: number }
  | { name: "post" }
  | { name: "how" }
  | { name: "not-found" };

/** Hash routes: #/ · #/calls/:id · #/post · #/how (no router dependency; works on any static host). */
export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, "") || "/";
  if (path === "/") return { name: "feed" };
  const call = /^\/calls\/(\d+)$/.exec(path);
  if (call) return { name: "call", id: Number(call[1]) };
  if (path === "/post") return { name: "post" };
  if (path === "/how") return { name: "how" };
  return { name: "not-found" };
}

export function hrefFor(route: Route): string {
  switch (route.name) {
    case "feed":
      return "#/";
    case "call":
      return `#/calls/${route.id}`;
    case "post":
      return "#/post";
    case "how":
      return "#/how";
    case "not-found":
      return "#/";
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => "");
  return parseHash(hash);
}
