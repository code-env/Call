import { useCallback, useRef, useState } from "react";
import { Device } from "mediasoup-client";
import type {
  Transport,
  Consumer,
  TransportOptions,
  RtpCapabilities,
  RtpParameters,
  Producer,
} from "mediasoup-client/types";
import { useSocket } from "@/components/providers/socket";
import { useRoom } from "@/components/providers/room";
import { useUsers, type User } from "@/components/providers/users";
import { toast } from "sonner";

interface JoinResponse {
  producers: {
    producerId: string;
    userId: string;
    kind: "audio" | "video" | "screen";
  }[];
  users: User[];
}

export function useMediasoupClient() {
  const { socket, connected } = useSocket();
  const { room } = useRoom();
  const { setUsers } = useUsers();
  const deviceRef = useRef<Device | null>(null);
  const sendTransportRef = useRef<Transport | null>(null);
  const recvTransportRef = useRef<Transport | null>(null);
  const screenShareProducerRef = useRef<Producer | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<MediaStream[]>([]);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const screenSendTransportRef = useRef<Transport | null>(null);
  const screenRecvTransportRef = useRef<Transport | null>(null);

  const joinRoom = useCallback(
    async (roomId: string, userId?: string): Promise<JoinResponse> => {
      if (!socket || !connected || !room) {
        console.error("Socket not connected");
        throw new Error("Socket not connected");
      }

      console.log("Creating/joining room:", room.id);

      try {
        await new Promise<void>((resolve, reject) => {
          if (room.id) {
            socket.emit("createRoom", { roomId: room.id }, (response: any) => {
              if (response.error) {
                reject(new Error(response.error));
              } else {
                resolve();
              }
            });
          } else {
            reject(new Error("Room ID is not available"));
          }
        });

        console.log("joining room", { roomId: room.id, userId });

        const responseData = await new Promise<JoinResponse>(
          (resolve, reject) => {
            socket.emit(
              "joinRoom",
              { roomId: room.id, token: "demo-token", userId },
              (response: any) => {
                if (response.error) {
                  reject(new Error(response.error));
                } else {
                  resolve(response);
                }
              }
            );
          }
        );
        socket.emit(
          "getUsersInRoom",
          { roomId: room.id },
          (response: any[]) => {
            const transformedUsers = response.map((user) => ({
              id: user.userId,
              name: user.userId,
              micActive: user.micActive,
              camActive: user.camActive,
              isShareScreen: user.isShareScreen,
            }));
            setUsers(transformedUsers);
          }
        );

        console.log("Successfully joined room:", room.id);
        setUsers(responseData.users);
        return responseData;
      } catch (error) {
        console.error("Error joining room:", error);
        throw error;
      }
    },
    [socket, connected, room]
  );

  // Load mediasoup device
  const loadDevice = useCallback(async (rtpCapabilities: RtpCapabilities) => {
    try {
      let device = deviceRef.current;
      if (!device) {
        console.log("Loading mediasoup device");
        device = new Device();
        await device.load({ routerRtpCapabilities: rtpCapabilities });
        deviceRef.current = device;
        console.log("Device loaded successfully");
      }
      return device;
    } catch (error) {
      console.error("Error loading device:", error);
      throw error;
    }
  }, []);

  const createSendTransport = useCallback(async () => {
    if (!socket) {
      console.error("Socket not available");
      return;
    }

    try {
      console.log("Creating send transport");
      return new Promise<Transport>((resolve, reject) => {
        socket.emit(
          "createWebRtcTransport",
          {},
          async (params: TransportOptions) => {
            try {
              const device = deviceRef.current;
              if (!device) {
                throw new Error("Device not loaded");
              }

              const transport = device.createSendTransport(params);

              transport.on(
                "connect",
                ({ dtlsParameters }, callback, errback) => {
                  console.log("Send transport connect event");
                  socket.emit(
                    "connectWebRtcTransport",
                    { transportId: transport.id, dtlsParameters },
                    (response: { connected: boolean; error?: string }) => {
                      if (response.error || !response.connected) {
                        errback(
                          new Error(response.error || "Connection failed")
                        );
                      } else {
                        callback();
                      }
                    }
                  );
                }
              );

              transport.on(
                "produce",
                ({ kind, rtpParameters }, callback, errback) => {
                  console.log("Send transport produce event", { kind });
                  socket.emit(
                    "produce",
                    { transportId: transport.id, kind, rtpParameters },
                    (response: { id?: string; error?: string }) => {
                      if (response.error || !response.id) {
                        errback(
                          new Error(response.error || "Production failed")
                        );
                      } else {
                        callback({ id: response.id });
                      }
                    }
                  );
                }
              );

              sendTransportRef.current = transport;
              console.log("Send transport created successfully");
              resolve(transport);
            } catch (error) {
              console.error("Error creating send transport:", error);
              reject(error);
            }
          }
        );
      });
    } catch (error) {
      console.error("Error in createSendTransport:", error);
      throw error;
    }
  }, [socket]);

  const createRecvTransport = useCallback(async () => {
    if (!socket) return;
    return new Promise<Transport>((resolve) => {
      socket.emit(
        "createWebRtcTransport",
        {},
        async (params: TransportOptions) => {
          const device = deviceRef.current;
          const transport = device!.createRecvTransport(params);
          transport.on("connect", ({ dtlsParameters }, cb, errCb) => {
            socket.emit(
              "connectWebRtcTransport",
              { transportId: transport.id, dtlsParameters },
              (res: { connected: boolean }) => {
                if (res.connected) cb();
                else errCb(new Error("Failed to connect transport"));
              }
            );
          });
          recvTransportRef.current = transport;
          resolve(transport);
        }
      );
    });
  }, [socket]);

  const produce = useCallback(async (stream: MediaStream) => {
    if (!sendTransportRef.current) {
      console.error("Send transport not ready");
      return;
    }

    try {
      console.log(
        "Got user media, tracks:",
        stream.getTracks().map((t) => t.kind)
      );
      setLocalStream(stream);

      const producers = [];
      for (const track of stream.getTracks()) {
        console.log(`Producing ${track.kind} track`);
        try {
          const producer = await sendTransportRef.current.produce({ track });
          console.log(
            `Successfully produced ${track.kind} track:`,
            producer.id
          );
          producers.push(producer);
        } catch (error) {
          console.error(`Failed to produce ${track.kind} track:`, error);
          // Continue with other tracks even if one fails
        }
      }

      if (producers.length === 0) {
        console.error("Failed to produce any media tracks");
        // Cleanup the stream since we couldn't produce any tracks
        stream.getTracks().forEach((track) => track.stop());
        setLocalStream(null);
      }

      return producers;
    } catch (error) {
      console.error("Error in produce:", error);
      throw error;
    }
  }, []);

  // Consume remote media
  const consume = useCallback(
    async (
      producerId: string,
      rtpCapabilities: RtpCapabilities,
      onStream?: (stream: MediaStream) => void
    ) => {
      if (!socket || !recvTransportRef.current) {
        console.error("Cannot consume - transport or socket not ready");
        return;
      }

      try {
        console.log("Consuming producer:", producerId);
        socket.emit(
          "consume",
          {
            transportId: recvTransportRef.current.id,
            producerId,
            rtpCapabilities,
          },
          async (res: {
            id: string;
            producerId: string;
            kind: string;
            rtpParameters: unknown;
            error?: string;
          }) => {
            if (res.error) {
              console.error("Consume request failed:", res.error);
              return;
            }

            if (!res.rtpParameters) {
              console.error("No RTP parameters in consume response");
              return;
            }

            try {
              const consumer: Consumer =
                await recvTransportRef.current!.consume({
                  id: res.id,
                  producerId: res.producerId,
                  kind: res.kind as "audio" | "video",
                  rtpParameters: res.rtpParameters as RtpParameters,
                });

              console.log("Consumer created successfully:", {
                id: consumer.id,
                kind: consumer.kind,
              });

              const stream = new MediaStream([consumer.track]);
              if (onStream) {
                onStream(stream);
              } else {
                setRemoteStreams((prev) => [...prev, stream]);
              }
            } catch (error) {
              console.error("Error while consuming:", error);
            }
          }
        );
      } catch (error) {
        console.error("Error in consume function:", error);
      }
    },
    [socket]
  );

  const createScreenSendTransport = useCallback(async () => {
    if (!socket) return;

    return new Promise<Transport>((resolve, reject) => {
      socket.emit(
        "createWebRtcTransport",
        {},
        async (params: TransportOptions) => {
          const device = deviceRef.current;
          if (!device) return reject("Device not loaded");

          const transport = device.createSendTransport(params);

          transport.on("connect", ({ dtlsParameters }, callback, errback) => {
            socket.emit(
              "connectWebRtcTransport",
              { transportId: transport.id, dtlsParameters },
              (res: { connected: boolean }) => {
                if (res.connected) callback();
                else errback(new Error("Failed to connect screen transport"));
              }
            );
          });

          transport.on(
            "produce",
            ({ kind, rtpParameters }, callback, errback) => {
              socket.emit(
                "produce",
                {
                  transportId: transport.id,
                  kind,
                  rtpParameters,
                  appData: { type: "screen" },
                },
                (res: { id?: string; error?: string }) => {
                  if (res?.error || !res.id) {
                    errback(new Error(res?.error || "Produce screen failed"));
                  } else {
                    callback({ id: res.id });
                  }
                }
              );
            }
          );

          sendTransportRef.current = transport;
          resolve(transport);
        }
      );
    });
  }, [socket]);

  const startScreenShare = useCallback(async () => {
    if (!socket) return;

    try {
      if (screenShareProducerRef.current) {
        screenShareProducerRef.current.close();
        screenShareProducerRef.current = null;
      }

      if (screenSendTransportRef.current) {
        screenSendTransportRef.current.close();
        screenSendTransportRef.current = null;
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });

      const screenTrack = stream.getVideoTracks()[0];
      if (!screenTrack) throw new Error("No video track for screen");

      screenTrack.onended = () => stopScreenShare();

      const screenTransport = await createScreenSendTransport();
      if (!screenTransport)
        throw new Error("Failed to create screen transport");

      const screenProducer = await screenTransport.produce({
        track: screenTrack,
        appData: { type: "screen" },
      });

      screenShareProducerRef.current = screenProducer;
      setIsScreenSharing(true);

      socket.emit(
        "startScreenShare",
        {
          transportId: screenTransport.id,
          rtpParameters: screenProducer.rtpParameters,
        },
        (response: { id?: string; error?: string; codecOptions?: any }) => {
          if (response.error) {
            console.error("Error starting screen share:", response.error);
            toast.error(response.error);
            stopScreenShare();
          } else {
            console.log("Screen share started successfully:", response.id);
            setIsScreenSharing(true);
          }
        }
      );

      console.log("Screen share producer created:", screenProducer.id);
    } catch (err) {
      console.error("Error starting screen share:", err);
      toast.error((err as Error).message);
    }
  }, [createScreenSendTransport, socket]);

  const stopScreenShare = useCallback(() => {
    if (screenShareProducerRef.current) {
      screenShareProducerRef.current.close();
      screenShareProducerRef.current = null;
    }

    setIsScreenSharing(false);

    if (socket) {
      socket.emit(
        "stopScreenShare",
        {},
        (response: { stopped?: boolean; error?: string }) => {
          if (response?.error) {
            console.error("Error stopping screen share:", response.error);
            toast.error(response.error);
          } else {
            console.log("Screen share stopped successfully");
          }
        }
      );
    }
  }, [socket]);

  return {
    joinRoom,
    loadDevice,
    createSendTransport,
    createRecvTransport,
    produce,
    consume,
    startScreenShare,
    stopScreenShare,
    isScreenSharing,
    localStream,
    setLocalStream,
    remoteStreams,
    connected,
    socket,
    device: deviceRef.current,
    deviceRef,
  };
}
