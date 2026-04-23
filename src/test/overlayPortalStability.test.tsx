import React, { useState } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { OverlayPortalProvider } from "@/components/overlay/OverlayPortalProvider";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function SharedPortalPopoverHarness() {
  const [open, setOpen] = useState(false);

  return (
    <OverlayPortalProvider>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button">NACE Ac</Button>
        </PopoverTrigger>
        <PopoverContent>
          <div>Overlay icerik</div>
        </PopoverContent>
      </Popover>
    </OverlayPortalProvider>
  );
}

describe("overlay portal stability", () => {
  it("renders into the shared overlay root even after translation-like body mutations", () => {
    render(<SharedPortalPopoverHarness />);

    const translationBanner = document.createElement("iframe");
    translationBanner.className = "goog-te-banner-frame";
    document.body.insertBefore(translationBanner, document.body.firstChild);

    expect(() => fireEvent.click(screen.getByRole("button", { name: "NACE Ac" }))).not.toThrow();

    expect(screen.getByText("Overlay icerik")).toBeInTheDocument();
    expect(document.querySelector("[data-app-overlay-root]")?.textContent).toContain("Overlay icerik");
  });
});
