"use client";

import React, { createContext, useContext, type ReactNode } from "react";
import { useMediasoupClient } from "@/hooks/use-mediasoup";

const MediasoupContext = createContext<ReturnType<
  typeof useMediasoupClient
> | null>(null);

export const MediasoupProvider = ({ children }: { children: ReactNode }) => {
  const mediasoup = useMediasoupClient();

  return (
    <MediasoupContext.Provider value={mediasoup}>
      {children}
    </MediasoupContext.Provider>
  );
};

export const useMediasoup = () => {
  const context = useContext(MediasoupContext);
  if (!context) {
    throw new Error("useMediasoup must be used within a MediasoupProvider");
  }
  return context;
};
