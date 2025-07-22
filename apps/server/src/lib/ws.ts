import type { Worker } from "mediasoup/types";
import type { Socket, Server as SocketIOServer } from "socket.io";
import { config } from "@/config/mediasoup";
import { Room } from "@/lib/room";
import { createTransport } from "@/lib/transport";
import { getMediasoupWorker } from "@/lib/worker";
import { db } from "@call/db";

const AUTH_TOKEN = "demo-token";

const rooms: Map<string, Room> = new Map();
let mediasoupWorker: Worker;

const socketIoConnection = async (io: SocketIOServer) => {
  if (!mediasoupWorker) {
    mediasoupWorker = getMediasoupWorker();
  }

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (token !== AUTH_TOKEN) {
      return next(new Error("Authentication error"));
    }
    next();
  });

  io.on("connection", (socket: Socket) => {
    let currentRoom: Room | undefined;
    let peerId = socket.id;

    socket.on("createRoom", async ({ roomId }, callback) => {
      if (!rooms.has(roomId)) {
        const router = await mediasoupWorker.createRouter({
          mediaCodecs: config.mediasoup.router.mediaCodecs,
        });
        const room = new Room(roomId, router);
        rooms.set(roomId, room);
      }

      //   if (!db.data!.rooms.find((r) => r.id === roomId)) {
      //     db.data!.rooms.push({ id: roomId, users: [] });
      //     await db.write();
      //   }
      //   callback({ roomId });
    });

    socket.on("joinRoom", async ({ roomId, token }, callback) => {
      if (token !== AUTH_TOKEN) return callback({ error: "Invalid token" });
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

      // await db.read();
      // let dbRoom = db.data!.rooms.find((r) => r.id === roomId);
      // if (dbRoom && !dbRoom.users.some((u) => u.userId === peerId)) {
      //   dbRoom.users.push({
      //     userId: peerId,
      //     micActive: true,
      //     camActive: true,
      //     isShareScreen: false,
      //   });
      //   await db.write();
      // }
      // if (!db.data!.users.find((u) => u.id === peerId)) {
      //   db.data!.users.push({ id: peerId, name: peerId });
      //   await db.write();
      // }

      const producers = currentRoom.getProducers();

      callback({ producers });
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

        // Notify all other users in the room about the new producer
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

      // await db.read();
      // const dbRoom = db.data!.rooms.find((r) => r.id === currentRoom!.id);
      // if (dbRoom) {
      //   dbRoom.users = dbRoom.users.filter((u) => u.userId !== peerId);
      //   await db.write();
      // }

      // const stillInRoom = db.data!.rooms.some((r) =>
      //   r.users.some((u) => u.userId === peerId)
      // );
      // if (!stillInRoom) {
      //   db.data!.users = db.data!.users.filter((u) => u.id !== peerId);
      //   await db.write();
      // }

      if (currentRoom.peers.size === 0) {
        rooms.delete(currentRoom.id);
        // db.data!.rooms = db.data!.rooms.filter((r) => r.id !== currentRoom!.id);
        await db.write();
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
        // await db.read();
        // const dbRoom = db.data!.rooms.find((r) => r.id === currentRoom!.id);
        // if (dbRoom) {
        //   dbRoom.users = dbRoom.users.map((u) =>
        //     u.userId === userId
        //       ? { ...u, micActive, camActive, isShareScreen }
        //       : u
        //   );
        //   await db.write();
        // }

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

    socket.on("getUsersInRoom", (data, callback) => {
      if (!currentRoom) return callback([]);
      console.log("getUsersInRoom", currentRoom);
      const users = Array.from(currentRoom.peers.values()).map((p) => ({
        userId: p.id,
        micActive: p.micActive,
        camActive: p.camActive,
        isShareScreen: p.isShareScreen,
      }));
      callback(users);
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
