import React, { createContext, useContext, useMemo, useState } from "react";

type OverlayPortalContextValue = {
  portalContainer: HTMLElement | null;
};

const OverlayPortalContext = createContext<OverlayPortalContextValue>({
  portalContainer: null,
});

export function OverlayPortalProvider({ children }: { children: React.ReactNode }) {
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const value = useMemo(() => ({ portalContainer }), [portalContainer]);

  return (
    <OverlayPortalContext.Provider value={value}>
      {children}
      <div
        id="app-overlay-root"
        data-app-overlay-root
        ref={(node) => {
          setPortalContainer(node);
        }}
      />
    </OverlayPortalContext.Provider>
  );
}

export function useOverlayPortalContainer() {
  return useContext(OverlayPortalContext).portalContainer;
}
