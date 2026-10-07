import type { CallView } from "@pop/core/browser";
import { badgeFor } from "./badge";

export function StatusBadge({ call }: { call: CallView }) {
  const badge = badgeFor(call);
  return (
    <span className={`badge badge-${badge.tone}`} role="status" aria-live="polite" data-testid={`badge-${call.id}`}>
      <strong>{badge.label}</strong>
      <span className="badge-detail">{badge.detail}</span>
    </span>
  );
}
