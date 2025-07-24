"use client";

import React, { createContext, useContext, type ReactNode } from "react";
import { useMediasoupClient } from "@/hooks/use-mediasoup";
import { useScreenShare } from "@/hooks/use-screenshare";

const ScreenShareContext = createContext<ReturnType<
  typeof useScreenShare
> | null>(null);

export const ScreenShareProvider = ({ children }: { children: ReactNode }) => {
  const screenShare = useScreenShare();

  return (
    <ScreenShareContext.Provider value={screenShare}>
      {children}
    </ScreenShareContext.Provider>
  );
};

export const useScreenShareProvider = () => {
  const context = useContext(ScreenShareContext);
  if (!context) {
    throw new Error("useScreenShare must be used within a ScreenShareProvider");
  }
  return context;
};
