import type { Worker } from "mediasoup/types";
import type { Socket, Server as SocketIOServer } from "socket.io";
import { config } from "@/config/mediasoup";
import { Room } from "@/lib/room";
import { createTransport } from "@/lib/transport";
import { getMediasoupWorker } from "@/lib/worker";
import { db } from "@call/db";
import {
  room as roomTable,
  roomUser as roomUserTable,
  user as userTable,
} from "@call/db/schema";
import { eq, and } from "drizzle-orm";
import chalk from "chalk";
import crypto from "crypto";

const AUTH_TOKEN = "demo-token";

const rooms: Map<string, Room> = new Map();
let mediasoupWorker: Worker;

const socketIoConnection = async (io: SocketIOServer) => {
  console.log(chalk.blue("🔧 Initializing Socket.IO connection handlers..."));

  if (!mediasoupWorker) {
    console.log(chalk.yellow("🔄 Creating mediasoup worker..."));
    mediasoupWorker = getMediasoupWorker();
    console.log(chalk.green("✅ Mediasoup worker created"));
  }

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (token !== AUTH_TOKEN) {
      console.log(
        chalk.red(`❌ Authentication failed for socket ${socket.id}`)
      );
      return next(new Error("Authentication error"));
    }
    console.log(
      chalk.green(`✅ Authentication successful for socket ${socket.id}`)
    );
    next();
  });

  io.on("connection", (socket: Socket) => {
    console.log(
      chalk.green(`🎯 Socket.IO connection established: ${socket.id}`)
    );
    let currentRoom: Room | undefined;
    let peerId = socket.id;

    // socket.on("createRoom", async ({ roomId }, callback) => {
    //   try {
    //     const dbRoom = await db
    //       .select()
    //       .from(roomTable)
    //       .where(eq(roomTable.id, roomId))
    //       .limit(1);

    //     if (dbRoom.length === 0) {
    //       return callback({ error: "Room not found in database" });
    //     }

    //     // Create mediasoup room if it doesn't exist
    //     if (!rooms.has(roomId)) {
    //       const router = await mediasoupWorker.createRouter({
    //         mediaCodecs: config.mediasoup.router.mediaCodecs,
    //       });
    //       const room = new Room(roomId, router);
    //       rooms.set(roomId, room);
    //     }

    //     callback({ roomId });
    //   } catch (error) {
    //     console.error("Error creating room:", error);
    //     callback({ error: "Failed to create room" });
    //   }
    // });

    socket.on("joinRoom", async ({ roomId, token, userId }, callback) => {
      if (token !== AUTH_TOKEN) return callback({ error: "Invalid token" });

      try {
        const dbRoom = await db
          .select()
          .from(roomTable)
          .where(eq(roomTable.id, roomId))
          .limit(1);

        if (dbRoom.length === 0) {
          return callback({ error: "Room not found" });
        }

        // Create or get mediasoup room
        let room = rooms.get(roomId);
        if (!room) {
          const router = await mediasoupWorker.createRouter({
            mediaCodecs: config.mediasoup.router.mediaCodecs,
          });
          room = new Room(roomId, router);
          rooms.set(roomId, room);
        }

        currentRoom = room;
        room.addPeer(peerId);

        console.log(`[Room ${roomId}] Peer ${peerId} joined`);
        console.log(
          `[Room ${roomId}] Current peers:`,
          Array.from(room.peers.keys())
        );

        socket.join(roomId);

        if (userId) {
          const user = await db
            .select()
            .from(userTable)
            .where(eq(userTable.id, userId))
            .limit(1);

          if (user.length > 0) {
            await db.insert(roomUserTable).values({
              id: crypto.randomUUID(),
              roomId,
              userId,
              isMicActive: true,
              isCamActive: true,
              isShareScreen: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
        }

        const producers = currentRoom.getProducers();
        callback({ producers });
      } catch (error) {
        console.error("Error joining room:", error);
        callback({ error: "Failed to join room" });
      }
    });

    socket.on("createWebRtcTransport", async (data, callback) => {
      if (!currentRoom) return callback({ error: "No room joined" });
      const { transport, params } = await createTransport(currentRoom.router);
      currentRoom.getPeer(peerId)?.transports.push(transport);
      callback(params);
    });

    socket.on(
      "connectWebRtcTransport",
      async ({ transportId, dtlsParameters }, callback) => {
        if (!currentRoom) return callback({ error: "No room joined" });
        const peer = currentRoom.getPeer(peerId);
        const transport = peer?.transports.find((t) => t.id === transportId);
        if (!transport) return callback({ error: "Transport not found" });
        await transport.connect({ dtlsParameters });
        callback({ connected: true });
      }
    );

    socket.on(
      "produce",
      async ({ transportId, kind, rtpParameters }, callback) => {
        if (!currentRoom) return callback({ error: "No room joined" });
        const peer = currentRoom.getPeer(peerId);
        const transport = peer?.transports.find((t) => t.id === transportId);
        if (!transport) return callback({ error: "Transport not found" });
        const producer = await transport.produce({ kind, rtpParameters });
        peer?.producers.push(producer);

        console.log(
          `[Room ${currentRoom.id}] Peer ${peerId} produced ${kind}`,
          {
            producerId: producer.id,
            transportId,
          }
        );

        socket.to(currentRoom.id).emit("newProducer", {
          producerId: producer.id,
          userId: peerId,
          kind,
        });

        console.log(
          `[Room ${currentRoom.id}] Notified other peers about new producer`,
          {
            producerId: producer.id,
            userId: peerId,
            kind,
          }
        );

        callback({ id: producer.id });
      }
    );

    socket.on(
      "produceData",
      async (
        { transportId, sctpStreamParameters, label, protocol },
        callback
      ) => {
        if (!currentRoom) return callback({ error: "No room joined" });
        const peer = currentRoom.getPeer(peerId);
        const transport = peer?.transports.find((t) => t.id === transportId);
        if (!transport) return callback({ error: "Transport not found" });
        const dataProducer = await transport.produceData({
          sctpStreamParameters,
          label,
          protocol,
        });
        peer?.dataProducers.push(dataProducer);
        callback({ id: dataProducer.id });
      }
    );

    socket.on(
      "consume",
      async ({ transportId, producerId, rtpCapabilities }, callback) => {
        if (!currentRoom) return callback({ error: "No room joined" });
        const peer = currentRoom.getPeer(peerId);
        const transport = peer?.transports.find((t) => t.id === transportId);
        if (!transport) return callback({ error: "Transport not found" });

        let producer;
        let isScreenShare = false;

        for (const p of currentRoom.peers.values()) {
          if (
            p.screenShareProducer &&
            p.screenShareProducer.id === producerId
          ) {
            producer = p.screenShareProducer;
            isScreenShare = true;
            break;
          }
        }

        if (!producer) {
          const producerPeer = Array.from(currentRoom.peers.values()).find(
            (p) => p.producers.some((pr) => pr.id === producerId)
          );
          producer = producerPeer?.producers.find((pr) => pr.id === producerId);
        }

        if (!producer) return callback({ error: "Producer not found" });
        if (!currentRoom.router.canConsume({ producerId, rtpCapabilities })) {
          return callback({ error: "Cannot consume" });
        }

        const consumer = await transport.consume({
          producerId,
          rtpCapabilities,
          paused: false,
          appData: {
            peerId,
            mediaType: isScreenShare ? "screenShare" : "webcam",
            mediaPeerId: producer.appData?.peerId,
          },
        });

        peer?.consumers.push(consumer);

        callback({
          id: consumer.id,
          producerId,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters,
          type: consumer.type,
          producerPaused: consumer.producerPaused,
          appData: isScreenShare ? { mediaType: "screenShare" } : undefined,
        });
      }
    );

    socket.on(
      "consumeData",
      async ({ transportId, dataProducerId }, callback) => {
        if (!currentRoom) return callback({ error: "No room joined" });
        const peer = currentRoom.getPeer(peerId);
        const transport = peer?.transports.find((t) => t.id === transportId);
        if (!transport) return callback({ error: "Transport not found" });
        const dataProducerPeer = Array.from(currentRoom.peers.values()).find(
          (p) => p.dataProducers.some((dp) => dp.id === dataProducerId)
        );
        const dataProducer = dataProducerPeer?.dataProducers.find(
          (dp) => dp.id === dataProducerId
        );
        if (!dataProducer) return callback({ error: "DataProducer not found" });
        const dataConsumer = await transport.consumeData({ dataProducerId });
        peer?.dataConsumers.push(dataConsumer);
        callback({
          id: dataConsumer.id,
          dataProducerId,
          sctpStreamParameters: dataConsumer.sctpStreamParameters,
          label: dataConsumer.label,
          protocol: dataConsumer.protocol,
        });
      }
    );

    const cleanupPeer = async () => {
      if (!currentRoom) return;

      const peer = currentRoom.getPeer(peerId);
      if (peer && peer.screenShareProducer) {
        console.log(
          `[Room ${currentRoom.id}] Peer ${peerId} disconnected while screen sharing`
        );

        socket.to(currentRoom.id).emit("screenShareStopped", {
          userId: peerId,
        });

        await peer.screenShareProducer.close();
        currentRoom.removeScreenShareProducer(peerId);
      }

      currentRoom.removePeer(peerId);
      socket.to(currentRoom.id).emit("userLeft", { userId: peerId });

      // Remove user from room_user table
      try {
        await db
          .delete(roomUserTable)
          .where(
            and(
              eq(roomUserTable.roomId, currentRoom.id),
              eq(roomUserTable.userId, peerId)
            )
          );
      } catch (error) {
        console.error("Error removing user from room:", error);
      }

      if (currentRoom.peers.size === 0) {
        rooms.delete(currentRoom.id);
      }
    };

    socket.on("getRouterRtpCapabilities", (data, callback) => {
      if (!currentRoom) return callback({ error: "No room joined" });
      callback(currentRoom.router.rtpCapabilities);
    });

    socket.on("getRoomProducers", (data, callback) => {
      if (!currentRoom) return callback([]);
      const producerIds = Array.from(currentRoom.peers.values())
        .filter((p) => p.id !== peerId)
        .flatMap((p) => p.producers.map((pr) => pr.id));
      callback(producerIds);
    });

    socket.on("getRoomProducersWithUsers", (data, callback) => {
      if (!currentRoom) return callback([]);
      const producersWithUsers = Array.from(currentRoom.peers.values())
        .filter((p) => p.id !== peerId)
        .flatMap((p) =>
          p.producers.map((pr) => ({
            producerId: pr.id,
            userId: p.id,
          }))
        );

      console.log(
        `[Room ${currentRoom.id}] Getting producers for peer ${peerId}`,
        {
          producers: producersWithUsers,
        }
      );

      callback(producersWithUsers);
    });

    socket.on(
      "updateUser",
      async ({ userId, micActive, camActive, isShareScreen }, callback) => {
        if (!currentRoom) {
          if (callback) callback({ error: "No room joined" });
          return;
        }
        const user = currentRoom.getPeer(userId);

        if (!user) {
          if (callback) callback({ error: "User not found" });
          return;
        }
        user.micActive = micActive;
        user.camActive = camActive;
        user.isShareScreen = isShareScreen;

        // Update user in database
        try {
          await db
            .update(roomUserTable)
            .set({
              isMicActive: micActive,
              isCamActive: camActive,
              isShareScreen: isShareScreen,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(roomUserTable.roomId, currentRoom.id),
                eq(roomUserTable.userId, userId)
              )
            );
        } catch (error) {
          console.error("Error updating user in database:", error);
        }

        socket.to(currentRoom.id).emit("userUpdated", {
          userId,
          micActive,
          camActive,
          isShareScreen,
        });

        if (callback) callback({ success: true });
      }
    );

    socket.on(
      "startScreenShare",
      async ({ transportId, rtpParameters }, callback) => {
        console.log("startScreenShare", {
          transportId,
          rtpParameters,
          currentRoom,
        });
        if (!currentRoom) return callback({ error: "No room joined" });
        const peer = currentRoom.getPeer(peerId);
        const transport = peer?.transports.find((t) => t.id === transportId);

        if (!transport) return callback({ error: "Transport not found" });

        try {
          const enhancedRtpParameters = {
            ...rtpParameters,
            encodings:
              rtpParameters.encodings ||
              config.mediasoup.screenSharing.encodings,
          };

          const screenShareProducer = await transport.produce({
            kind: "video",
            rtpParameters: enhancedRtpParameters,
            appData: {
              mediaType: "screenShare",
              peerId,
              codecOptions: config.mediasoup.screenSharing.codecOptions,
            },
          });

          currentRoom.addScreenShareProducer(peerId, screenShareProducer);

          console.log(
            `[Room ${currentRoom.id}] Peer ${peerId} started screen sharing`,
            {
              producerId: screenShareProducer.id,
              encodings: enhancedRtpParameters.encodings,
            }
          );

          socket.to(currentRoom.id).emit("newScreenShare", {
            producerId: screenShareProducer.id,
            userId: peerId,
            appData: { mediaType: "screenShare" },
          });

          callback({
            id: screenShareProducer.id,
            codecOptions: config.mediasoup.screenSharing.codecOptions,
          });
        } catch (error) {
          console.error("Error starting screen share:", error);
          callback({ error: "Could not start screen sharing" });
        }
      }
    );

    socket.on("stopScreenShare", async (data, callback) => {
      if (!currentRoom) return callback({ error: "No room joined" });
      const peer = currentRoom.getPeer(peerId);

      if (!peer || !peer.screenShareProducer) {
        return callback({ error: "No active screen share found" });
      }

      try {
        await peer.screenShareProducer.close();

        currentRoom.removeScreenShareProducer(peerId);

        console.log(
          `[Room ${currentRoom.id}] Peer ${peerId} stopped screen sharing`
        );

        socket.to(currentRoom.id).emit("screenShareStopped", {
          userId: peerId,
        });

        callback({ stopped: true });
      } catch (error) {
        console.error("Error stopping screen share:", error);
        callback({ error: "Could not stop screen sharing" });
      }
    });

    socket.on("getActiveScreenShares", (data, callback) => {
      if (!currentRoom) return callback([]);

      const screenShares = currentRoom.getScreenShareProducers();
      console.log(
        `[Room ${currentRoom.id}] Getting active screen shares for peer ${peerId}`,
        {
          screenShares,
        }
      );

      callback(screenShares);
    });

    socket.on("getUsersInRoom", async (data, callback) => {
      if (!currentRoom) return callback([]);

      try {
        // Get users from database
        const roomUsers = await db
          .select({
            userId: roomUserTable.userId,
            isMicActive: roomUserTable.isMicActive,
            isCamActive: roomUserTable.isCamActive,
            isShareScreen: roomUserTable.isShareScreen,
          })
          .from(roomUserTable)
          .where(eq(roomUserTable.roomId, currentRoom.id));

        // Map to expected format
        const users = roomUsers.map((u) => ({
          userId: u.userId,
          micActive: u.isMicActive,
          camActive: u.isCamActive,
          isShareScreen: u.isShareScreen,
        }));

        console.log(`[Room ${currentRoom.id}] Users in room:`, users);
        callback(users);
      } catch (error) {
        console.error("Error fetching users in room:", error);
        callback([]);
      }
    });

    socket.on("disconnect", async () => {
      await cleanupPeer();
    });

    socket.on("leaveRoom", async () => {
      await cleanupPeer();
    });
  });
};

export { socketIoConnection };
