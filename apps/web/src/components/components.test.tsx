import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "../api/client";
import { callView, fakeChain, fakeFetch, NVDAB, NVDAB_DTO, renderWithServices, testServices } from "../testing";
import { badgeFor, exitLine, hasFlipped } from "./badge";
import { CallCard, followBlocker } from "./CallCard";
import { evidenceText } from "./ExitEvidenceLine";

const NOW = 1_791_000_030_000;

describe("badge", () => {
  it("maps every status to its badge", () => {
    expect(badgeFor(callView(0, {}, 0))).toEqual({ label: "HOLDING ✓", detail: "verified on-chain", tone: "holding" });
    expect(badgeFor(callView(0, {}, 1)).tone).toBe("trimmed");
    expect(badgeFor(callView(0, {}, 2))).toEqual({ label: "EXITED", detail: "no longer holds it", tone: "exited" });
    expect(badgeFor(callView(0, { heldThrough: true, closedBlock: 9n }, 3))).toEqual({ label: "CLOSED", detail: "held through ✓", tone: "closed" });
    expect(badgeFor(callView(0, { closedBlock: 9n }, 3)).detail).toBe("exited while open");
  });

  it("keeps the exit line once recorded", () => {
    expect(exitLine(callView(0))).toBeNull();
    expect(exitLine(callView(0, { exitBlock: 104n, exitStatus: 2 }, 0))).toBe("Exit recorded on-chain · block 104 · 4 blocks after post");
    expect(hasFlipped(callView(0, { exitBlock: 104n, exitStatus: 2 }, 0))).toBe(true);
    expect(hasFlipped(callView(0, { heldThrough: true, closedBlock: 9n }, 3))).toBe(false);
  });
});

describe("evidenceText", () => {
  it("describes sales, contract moves and transfers", () => {
    const base = { txHash: "0xabc", amount: "0.02", timeMs: null, priceUsd: null, volumeUsd: null, dexName: null, counterparty: null, source: "rpc-logs" as const };
    expect(evidenceText({ ...base, kind: "sale", dexName: "PancakeSwap", priceUsd: "187.4", source: "market-api" }, NVDAB_DTO)).toBe("sold 0.02 NVIDIA · PancakeSwap @ $187.4");
    expect(evidenceText({ ...base, kind: "contract" }, NVDAB_DTO)).toBe("moved 0.02 NVDAB into a contract (likely a sale)");
    expect(evidenceText({ ...base, kind: "transfer", counterparty: "0x2222222222222222222222222222222222222222" }, NVDAB_DTO)).toBe(
      "transferred 0.02 NVDAB to 0x2222…2222",
    );
  });
});

describe("CallCard", () => {
  it("renders a HOLDING call with its actions", () => {
    const onFollow = vi.fn();
    const onToggleWatch = vi.fn();
    const call = callView(3, { note: "AI capex keeps compounding" });
    renderWithServices(<CallCard call={call} token={NVDAB_DTO} nowMs={NOW} watched={false} flash={false} onFollow={onFollow} onToggleWatch={onToggleWatch} />);
    expect(screen.getByRole("heading").textContent).toBe("LONG NVIDIA · 0.02 shares · bStocks");
    expect(screen.getByTestId("badge-3").textContent).toBe("HOLDING ✓verified on-chain");
    expect(screen.getByText("Market open")).toBeTruthy();
    expect(screen.getByText("AI capex keeps compounding")).toBeTruthy();
    expect(screen.getByText("Verify on BscScan").getAttribute("href")).toBe(`https://bscscan.com/token/${NVDAB}?a=0x1111111111111111111111111111111111111111`);
    fireEvent.click(screen.getByText("Follow with USDT"));
    expect(onFollow).toHaveBeenCalledWith(call);
    fireEvent.click(screen.getByText("Alert me"));
    expect(onToggleWatch).toHaveBeenCalledWith(3);
  });

  it("shows the sticky exit and its evidence once the caller sold", async () => {
    const api = createApiClient(
      "",
      fakeFetch({
        "GET /api/calls/4/exit": () => ({
          body: {
            callId: 4,
            status: "EXITED",
            evidence: { kind: "sale", txHash: "0xabcdef0123456789", amount: "0.02", timeMs: 1, priceUsd: "187.4", volumeUsd: "3.7", dexName: "PancakeSwap", counterparty: null, source: "market-api" },
          },
        }),
      }),
    );
    const call = callView(4, { exitBlock: 103n, exitStatus: 2 }, 2);
    renderWithServices(
      <CallCard call={call} token={NVDAB_DTO} nowMs={NOW} watched={true} flash={true} onFollow={() => {}} onToggleWatch={() => {}} />,
      testServices({ api }),
    );
    expect(screen.getByTestId("badge-4").textContent).toBe("EXITEDno longer holds it");
    expect(screen.getByText("Exit recorded on-chain · block 103 · 3 blocks after post")).toBeTruthy();
    await waitFor(() => expect(screen.getByText(/sold 0.02 NVIDIA · PancakeSwap @ \$187.4/)).toBeTruthy());
    expect(screen.getByText("tx 0xabcd…6789").getAttribute("href")).toBe("https://bscscan.com/tx/0xabcdef0123456789");
    expect((screen.getByText("Follow with USDT") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Alerts on ✓")).toBeTruthy();
    expect(screen.getByTestId("call-4").className).toBe("card flash");
  });

  it("shows an agent's ERC-8004 integrity score", async () => {
    const chain = fakeChain({
      readContract: async (request: { functionName: string }) => {
        if (request.functionName !== "getSummary") throw new Error(request.functionName);
        return [1n, 100n, 0];
      },
    });
    const call = callView(5, { hasAgent: true, agentId: 7n });
    renderWithServices(<CallCard call={call} token={NVDAB_DTO} nowMs={NOW} watched={false} flash={false} onFollow={() => {}} onToggleWatch={() => {}} />, testServices({ chain }));
    await waitFor(() => expect(screen.getByText(/AGENT #7/).textContent).toBe("AGENT #7 · integrity 100"));
  });

  it("explains why a call cannot be followed", () => {
    const xstock = { ...NVDAB_DTO, issuer: "xStocks" as const, symbol: "NVDAx" };
    expect(followBlocker(callView(0), NVDAB_DTO)).toBeNull();
    expect(followBlocker(callView(0), xstock)).toMatch(/bStocks only/);
    expect(followBlocker(callView(0, {}, 2), NVDAB_DTO)).toMatch(/still HOLDING/);
    expect(followBlocker(callView(0), { ...NVDAB_DTO, status: { openState: false, marketStatus: "pause", reasonCode: "ASSET_PAUSED", reasonMsg: "split" } })).toBe("Paused — split");
  });
});
