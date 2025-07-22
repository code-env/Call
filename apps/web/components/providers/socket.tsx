"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { io, Socket } from "socket.io-client";

const SOCKET_URL = "http://127.0.0.1:1284";
const AUTH_TOKEN = "demo-token";

const SocketContext = createContext<{
  socket: Socket | null;
  connected: boolean;
} | null>(null);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      auth: { token: AUTH_TOKEN },
      autoConnect: true,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Socket connected successfully");
      setConnected(true);
    });

    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
      const manager = socket.io;
      if (
        manager &&
        manager.opts &&
        manager.opts.transports &&
        manager.opts.transports[0] === "websocket"
      ) {
        console.log("falling back to polling transport");
        manager.opts.transports = ["websocket", "polling"];
      }
    });

    socket.on("error", (error) => {
      console.error("Socket error:", error);
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket disconnected", reason);
      setConnected(false);
    });

    return () => {
      console.log("Cleaning up socket connection");
      if (socket.connected) {
        socket.disconnect();
      }
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
};
