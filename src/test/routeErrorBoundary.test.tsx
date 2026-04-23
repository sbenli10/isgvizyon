import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";

const sentryMocks = vi.hoisted(() => ({
  captureException: vi.fn(),
}));

vi.mock("@/lib/sentry", () => ({
  Sentry: {
    captureException: sentryMocks.captureException,
  },
}));

function BrokenSection(): React.ReactElement {
  throw new Error("companies section crashed");
}

describe("RouteErrorBoundary", () => {
  beforeEach(() => {
    sentryMocks.captureException.mockClear();
    window.history.pushState({}, "", "/companies");
  });

  it("isolates failures between companies subsections", () => {
    render(
      <>
        <RouteErrorBoundary routeKey="companies:list" componentName="CompanyManagerList">
          <BrokenSection />
        </RouteErrorBoundary>
        <RouteErrorBoundary routeKey="companies:import" componentName="CompanyManagerImport">
          <div data-testid="healthy-section">Toplu aktarim saglam</div>
        </RouteErrorBoundary>
      </>,
    );

    expect(screen.getByText("Bu ekran yüklenirken sorun oluştu")).toBeInTheDocument();
    expect(screen.getByTestId("healthy-section")).toHaveTextContent("Toplu aktarim saglam");
    expect(sentryMocks.captureException).toHaveBeenCalled();
  });
});
