import { SocketProvider } from "@/components/providers/socket";
import { UsersProvider } from "@/components/providers/users";
import React from "react";

const RoomLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <SocketProvider>
      <UsersProvider>{children}</UsersProvider>
    </SocketProvider>
  );
};

export default RoomLayout;
