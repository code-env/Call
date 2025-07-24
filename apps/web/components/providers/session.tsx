"use client";

import { type PropsWithChildren, createContext, useContext } from "react";
import { type Session } from "@call/auth/auth";

export const SessionContext = createContext<Session | null>(null);

export const SessionProvider = ({
  children,
  value,
}: PropsWithChildren<{ value: Session }>) => {
  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
};
