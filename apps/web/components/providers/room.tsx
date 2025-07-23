"use client";

import { createContext, useContext, useState } from "react";
import type { Room } from "@call/db/types";
import { useQuery } from "@tanstack/react-query";
import { ROOM_QUERY } from "@/lib/QUERIES";
import { usePathname } from "next/navigation";

interface RoomContextType {
  room: Room | null;
}

const RoomContext = createContext<RoomContextType | undefined>(undefined);

export const RoomProvider = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const roomId = pathname.split("/")[2];

  const { data: room } = useQuery({
    queryKey: ["room"],
    queryFn: () => ROOM_QUERY.getRoom(roomId!),
  });

  console.log(room);

  return (
    <RoomContext.Provider value={{ room }}>{children}</RoomContext.Provider>
  );
};

export const useRoom = () => {
  const context = useContext(RoomContext);
  if (!context) {
    throw new Error("useRoom must be used within a RoomProvider");
  }
  return context;
};
