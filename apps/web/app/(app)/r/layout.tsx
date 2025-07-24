import { MediasoupProvider } from "@/components/providers/mediasoup";
import { RoomProvider } from "@/components/providers/room";
import { SocketProvider } from "@/components/providers/socket";
import { UsersProvider } from "@/components/providers/users";
import React from "react";

const RoomLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <SocketProvider>
      <RoomProvider>
        <UsersProvider>
          <MediasoupProvider>{children}</MediasoupProvider>
        </UsersProvider>
      </RoomProvider>
    </SocketProvider>
  );
};

export default RoomLayout;
