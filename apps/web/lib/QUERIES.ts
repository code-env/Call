import { apiClient } from "./api-client";

export const ROOM_QUERY = {
  getRoom: async (roomId: string) => {
    const res = await apiClient.get(`/rooms/${roomId}`);
    if (res.status === 200) {
      return res.data;
    }
    throw new Error("Failed to fetch room");
  },
  getUsersInRoom: async (roomId: string) => {
    const res = await apiClient.get(`/rooms/${roomId}/users`);
    if (res.status === 200) {
      return res.data;
    }
    throw new Error("Failed to fetch users in room");
  },
};
