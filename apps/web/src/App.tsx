import type { CallView } from "@pop/core/browser";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { flipMessage, notify, useToasts, useWatched } from "./alerts/alerts";
import { Toasts } from "./alerts/Toasts";
import { useTokens } from "./api/useTokens";
import type { Flip } from "./chain/diff";
import { useLiveCalls } from "./chain/useLiveCalls";
import { Disclaimer } from "./components/Disclaimer";
import { FollowModal } from "./components/FollowModal";
import { CallPage } from "./pages/CallPage";
import { FeedPage, type CardHandlers } from "./pages/FeedPage";
import { HowPage } from "./pages/HowPage";
import { PostPage } from "./pages/PostPage";
import { hrefFor, useRoute, type Route } from "./router";
import { useServices } from "./services";
import { WalletButton } from "./wallet/useWallet";

const FLASH_MS = 2_500;

function NavLink({ current, to, children }: { current: Route; to: Route; children: ReactNode }) {
  return (
    <a href={hrefFor(to)} aria-current={current.name === to.name ? "page" : undefined}>
      {children}
    </a>
  );
}

export function App() {
  const { api, chain, registry } = useServices();
  const route = useRoute();
  const tokens = useTokens(api);
  const { watched, toggle } = useWatched();
  const { toasts, push, dismiss } = useToasts();
  const [flashing, setFlashing] = useState<ReadonlySet<number>>(() => new Set());
  const [following, setFollowing] = useState<CallView | null>(null);
  const latest = useRef({ watched, tokens });
  latest.current = { watched, tokens };

  const onFlips = useCallback(
    (flips: Flip[], calls: CallView[]) => {
      for (const flip of flips) {
        const call = calls.find((candidate) => candidate.id === flip.callId);
        const token = call ? latest.current.tokens.byAddress.get(call.token.toLowerCase()) : undefined;
        const text = flipMessage(flip, call, token);
        push(text, flip.kind === "exited" || flip.kind === "trimmed" ? "bad" : "info");
        if (latest.current.watched.has(flip.callId)) notify("Proof of Position", text);
      }
      setFlashing(new Set(flips.map((flip) => flip.callId)));
    },
    [push],
  );

  useEffect(() => {
    if (flashing.size === 0) return;
    const timer = setTimeout(() => setFlashing(new Set()), FLASH_MS);
    return () => clearTimeout(timer);
  }, [flashing]);

  const live = useLiveCalls(chain, registry, { limit: 50, onFlips });
  const handlers: CardHandlers = { watched, flashing, onToggleWatch: toggle, onFollow: setFollowing };

  let page: ReactNode;
  switch (route.name) {
    case "feed":
      page = <FeedPage live={live} tokens={tokens} registry={registry} handlers={handlers} />;
      break;
    case "call":
      page = <CallPage id={route.id} calls={live.calls} tokens={tokens} handlers={handlers} />;
      break;
    case "post":
      page = <PostPage tokens={tokens} />;
      break;
    case "how":
      page = <HowPage registry={registry} />;
      break;
    case "not-found":
      page = (
        <p className="panel">
          Page not found. <a href={hrefFor({ name: "feed" })}>Back to the feed</a>
        </p>
      );
      break;
  }

  return (
    <div className="app">
      <header className="top">
        <a className="brand" href={hrefFor({ name: "feed" })}>
          Proof of Position
        </a>
        <nav aria-label="Main">
          <NavLink current={route} to={{ name: "feed" }}>
            Feed
          </NavLink>
          <NavLink current={route} to={{ name: "post" }}>
            Post a call
          </NavLink>
          <NavLink current={route} to={{ name: "how" }}>
            How it works
          </NavLink>
        </nav>
        <WalletButton />
      </header>
      <main>{page}</main>
      <Disclaimer />
      <Toasts toasts={toasts} dismiss={dismiss} />
      {following && <FollowModal call={following} token={tokens.byAddress.get(following.token.toLowerCase())} onClose={() => setFollowing(null)} />}
    </div>
  );
}
