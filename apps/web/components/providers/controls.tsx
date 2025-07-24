"use client";

import React, { createContext, useContext, type ReactNode } from "react";
import { useMediaControl } from "@/hooks/use-mediacontrol";

const ControlsContext = createContext<ReturnType<
  typeof useMediaControl
> | null>(null);

export const ControlsProvider = ({ children }: { children: ReactNode }) => {
  const controls = useMediaControl();

  return (
    <ControlsContext.Provider value={controls}>
      {children}
    </ControlsContext.Provider>
  );
};

export const useControls = () => {
  const context = useContext(ControlsContext);
  if (!context) {
    throw new Error("useControls must be used within a ControlsProvider");
  }
  return context;
};
