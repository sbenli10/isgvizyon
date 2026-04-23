import React, { useState } from "react";
import { describe, it, expect } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { useRouteOverlayCleanup } from "@/hooks/useRouteOverlayCleanup";

function OverlayCleanupHarness() {
  const [open, setOpen] = useState(true);
  useRouteOverlayCleanup(() => setOpen(false));

  return <div data-testid="overlay-state">{open ? "open" : "closed"}</div>;
}

describe("useRouteOverlayCleanup", () => {
  it("closes transient overlay state on route changes", () => {
    window.history.pushState({}, "", "/companies");

    render(
      <BrowserRouter>
        <OverlayCleanupHarness />
      </BrowserRouter>,
    );

    expect(screen.getByTestId("overlay-state")).toHaveTextContent("open");

    act(() => {
      window.history.pushState({}, "", "/dashboard");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(screen.getByTestId("overlay-state")).toHaveTextContent("closed");
  });
});
