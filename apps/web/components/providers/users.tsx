import { createContext, useContext, useEffect, useState } from "react";
import { useSocket } from "./socket";

type User = {
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
  const [users, setUsers] = useState<User[]>([]);
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    const getUsersInRoom = () => {
      socket.emit("getUsersInRoom", {}, (response: any[]) => {
        const transformedUsers = response.map((user) => ({
          id: user.userId,
          name: user.userId,
          micActive: user.micActive,
          camActive: user.camActive,
          isShareScreen: user.isShareScreen,
        }));
        setUsers(transformedUsers);
      });
    };

    getUsersInRoom();

    const handleUserUpdated = (updatedUser: any) => {
      setUsers((prevUsers) => {
        const existingUserIndex = prevUsers.findIndex(
          (u) => u.id === updatedUser.userId
        );

        if (existingUserIndex >= 0) {
          const existingUser = prevUsers[existingUserIndex]!;
          const updatedUsers = [...prevUsers];
          updatedUsers[existingUserIndex] = {
            id: existingUser.id,
            name: existingUser.name,
            micActive: updatedUser.micActive,
            camActive: updatedUser.camActive,
            isShareScreen: updatedUser.isShareScreen,
          };
          return updatedUsers;
        } else {
          return [
            ...prevUsers,
            {
              id: updatedUser.userId,
              name: updatedUser.userId,
              micActive: updatedUser.micActive,
              camActive: updatedUser.camActive,
              isShareScreen: updatedUser.isShareScreen,
            },
          ];
        }
      });
    };

    const handleUserLeft = ({ userId }: { userId: string }) => {
      setUsers((prevUsers) => prevUsers.filter((user) => user.id !== userId));
    };

    socket.on("userUpdated", handleUserUpdated);
    socket.on("userLeft", handleUserLeft);

    return () => {
      socket.off("userUpdated", handleUserUpdated);
      socket.off("userLeft", handleUserLeft);
    };
  }, [socket]);

  return (
    <UserContext.Provider value={{ users, setUsers }}>
      {children}
    </UserContext.Provider>
  );
};
