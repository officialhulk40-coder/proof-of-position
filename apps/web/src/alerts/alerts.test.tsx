import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { callView, NVDAB_DTO } from "../testing";
import { flipMessage, loadWatched, saveWatched, useToasts, useWatched } from "./alerts";
import { Toasts } from "./Toasts";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value), data };
}

afterEach(() => vi.useRealTimers());

describe("watched calls", () => {
  it("loads, saves and survives bad data", () => {
    const storage = memoryStorage({ "pop.watched.v1": "[3,1,-2,\"x\"]" });
    expect([...loadWatched(storage)]).toEqual([3, 1]);
    saveWatched(storage, new Set([5, 2]));
    expect(storage.data.get("pop.watched.v1")).toBe("[2,5]");
    expect(loadWatched(memoryStorage({ "pop.watched.v1": "{oops" })).size).toBe(0);
    expect(loadWatched(null).size).toBe(0);
  });

  it("toggles and persists", () => {
    const storage = memoryStorage();
    const { result } = renderHook(() => useWatched(storage));
    act(() => result.current.toggle(4));
    expect(result.current.watched.has(4)).toBe(true);
    expect(storage.data.get("pop.watched.v1")).toBe("[4]");
    act(() => result.current.toggle(4));
    expect(result.current.watched.has(4)).toBe(false);
  });
});

describe("flipMessage", () => {
  it("describes each flip", () => {
    expect(flipMessage({ callId: 4, from: "HOLDING", to: "EXITED", kind: "exited" }, callView(4, {}, 2), NVDAB_DTO)).toBe(
      "Call #4 · NVIDIA: the caller exited. Badge is now EXITED.",
    );
    expect(flipMessage({ callId: 4, from: "HOLDING", to: "CLOSED", kind: "closed" }, callView(4, { heldThrough: true, closedBlock: 9n }, 3), NVDAB_DTO)).toBe(
      "Call #4 · NVIDIA: closed by the caller · held through ✓.",
    );
    expect(flipMessage({ callId: 4, from: "EXITED", to: "EXITED", kind: "exit-recorded" }, callView(4, { exitBlock: 120n, exitStatus: 2 }, 2), NVDAB_DTO)).toBe(
      "Call #4 · NVIDIA: exit recorded on-chain at block 120.",
    );
  });
});

describe("toasts", () => {
  it("shows, dismisses and expires toasts", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useToasts(1_000));
    act(() => result.current.push("Call #4 exited", "bad"));
    act(() => result.current.push("Call #5 closed"));
    expect(result.current.toasts.map((toast) => toast.text)).toEqual(["Call #4 exited", "Call #5 closed"]);
    const first = result.current.toasts[0];
    act(() => result.current.dismiss(first?.id ?? -1));
    expect(result.current.toasts).toHaveLength(1);
    act(() => vi.advanceTimersByTime(1_000));
    expect(result.current.toasts).toHaveLength(0);
  });

  it("renders toasts with a dismiss button", () => {
    const dismiss = vi.fn();
    render(<Toasts toasts={[{ id: 1, text: "Call #4 exited", tone: "bad" }]} dismiss={dismiss} />);
    expect(screen.getByText("Call #4 exited")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Dismiss"));
    expect(dismiss).toHaveBeenCalledWith(1);
  });
});
