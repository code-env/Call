"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRoom } from "./room";
import { useSocket } from "./socket";

export type User = {
  id: string;
  name: string;
  micActive: boolean;
  camActive: boolean;
  isShareScreen: boolean;
};

type UserContextType = {
  users: User[];
  setUsers: (users: User[]) => void;
};

const UserContext = createContext<UserContextType | null>(null);

export const useUsers = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUsers must be used within a UsersProvider");
  }
  return context;
};

export const UsersProvider = ({ children }: { children: React.ReactNode }) => {
  const { socket } = useSocket();
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    console.log("users", { users });
  }, [users]);

  return (
    <UserContext.Provider value={{ users, setUsers }}>
      {children}
    </UserContext.Provider>
  );
};
