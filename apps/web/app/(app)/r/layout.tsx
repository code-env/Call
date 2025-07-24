import { MediasoupProvider } from "@/components/providers/mediasoup";
import { RoomProvider } from "@/components/providers/room";
import { ScreenShareProvider } from "@/components/providers/screen-share";
import { SocketProvider } from "@/components/providers/socket";
import { UsersProvider } from "@/components/providers/users";
import React from "react";

const RoomLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <SocketProvider>
      <RoomProvider>
        <UsersProvider>
          <MediasoupProvider>
            <ScreenShareProvider>{children}</ScreenShareProvider>
          </MediasoupProvider>
        </UsersProvider>
      </RoomProvider>
    </SocketProvider>
  );
};

export default RoomLayout;
