"use client";

import MediaControls from "@/components/media-controls";
import Player from "@/components/player";
import { useUsers } from "@/components/providers/users";
import ScreenShareDisplay from "@/components/screenshare-display";
import { useMediasoupClient } from "@/hooks/use-mediasoup";
import { useScreenShare } from "@/hooks/use-screenshare";
import { Button } from "@call/ui/components/button";
import { Badge } from "@call/ui/components/badge";
import type { Device } from "mediasoup-client";
import type { AppData, Transport } from "mediasoup-client/types";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Select } from "@call/ui/components/select";
import { CameraIcon, MicIcon } from "lucide-react";
import { useMediaControl } from "@/hooks/use-mediacontrol";

const RoomPage = ({ id }: { id: string }) => {
  const router = useRouter();
  const { users } = useUsers();

  const {
    joinRoom,
    loadDevice,
    createSendTransport,
    createRecvTransport,
    produce,
    localStream,
    setLocalStream,
    connected,
    socket,
    consume,
    deviceRef,
  } = useMediasoupClient();

  const { onNewScreenShare, onScreenShareStopped } = useScreenShare();

  const [roomId, setRoomId] = useState(id);
  const [joined, setJoined] = useState(false);
  const [roomData, setRoomData] = useState<any>(null);
  const [userId, setUserId] = useState<string>("");
  const consumedProducersRef = useRef<Set<string>>(new Set());
  const [remoteStreams, setRemoteStreams] = useState<
    Record<string, MediaStream>
  >({});

  const {
    localStreamRef,
    videoRef,
    cameraEnabled,
    micEnabled,
    toggleCamera,
    toggleMic,
    loadMediaDevices,
  } = useMediaControl();

  // Generate a temporary user ID for demo purposes
  useEffect(() => {
    setUserId(`user-${Math.random().toString(36).substr(2, 9)}`);
  }, []);

  const consumeAndAddTrack = useCallback(
    async ({
      producerId,
      userId,
      device,
    }: {
      producerId: string;
      userId: string;
      kind: "audio" | "video";
      device: Device;
    }) => {
      if (consumedProducersRef.current.has(producerId)) return;
      await consume(
        producerId,
        device.rtpCapabilities,
        (stream: MediaStream) => {
          consumedProducersRef.current.add(producerId);
          const newTrack = stream.getTracks()[0];

          setRemoteStreams((prevStreams) => {
            const newStreams = { ...prevStreams };
            let existingStream = newStreams[userId];

            if (existingStream) {
              existingStream.addTrack(newTrack as MediaStreamTrack);
            } else {
              existingStream = new MediaStream([newTrack as MediaStreamTrack]);
              newStreams[userId] = existingStream;
            }

            return newStreams;
          });
        }
      );
    },
    [consume]
  );

  const handleUserLeft = ({ userId }: { userId: string }) => {
    console.log("User left:", userId);
    setRemoteStreams((prevStreams) => {
      const newStreams = { ...prevStreams };
      if (newStreams[userId]) {
        newStreams[userId].getTracks().forEach((track) => track.stop());
        delete newStreams[userId];
      }
      return newStreams;
    });
    toast.info(`User ${userId} has left the room.`);
  };

  const [sendTransport, setSendTransport] = useState<Transport | null>(null);

  const [screenShares, setScreenShares] = useState<Record<string, MediaStream>>(
    {}
  );

  useEffect(() => {
    if (!socket || !joined) return;

    const currentDevice = deviceRef.current;
    if (!currentDevice) return;

    const handleNewProducer = async ({ producerId, userId, kind }: any) => {
      await consumeAndAddTrack({
        producerId,
        userId,
        kind,
        device: currentDevice,
      });
    };

    const handleNewScreenShare = async ({
      producerId,
      userId,
      appData,
    }: any) => {
      console.log("New screen share detected:", {
        producerId,
        userId,
        appData,
      });

      if (consumedProducersRef.current.has(producerId)) return;

      await consume(
        producerId,
        currentDevice.rtpCapabilities,
        (stream: MediaStream) => {
          consumedProducersRef.current.add(producerId);

          setScreenShares((prev) => ({
            ...prev,
            [userId]: stream,
          }));
        }
      );
    };

    const handleScreenShareStopped = ({ userId }: { userId: string }) => {
      console.log("Screen share stopped:", userId);

      setScreenShares((prev) => {
        const newScreenShares = { ...prev };
        if (newScreenShares[userId]) {
          newScreenShares[userId].getTracks().forEach((track) => track.stop());
          delete newScreenShares[userId];
        }
        return newScreenShares;
      });
    };

    const handleUserUpdated = ({
      userId,
      micActive,
      camActive,
      isShareScreen,
    }: any) => {
      console.log("User updated:", {
        userId,
        micActive,
        camActive,
        isShareScreen,
      });
      setRemoteStreams((prevStreams) => {
        const newStreams = { ...prevStreams };
        if (newStreams[userId]) {
          newStreams[userId].getTracks().forEach((track) => {
            if (track.kind === "audio") {
              track.enabled = micActive;
            } else if (track.kind === "video") {
              track.enabled = camActive;
            }
          });
        }

        console.log("newStreams", newStreams);
        return newStreams;
      });
    };

    socket.on("newProducer", handleNewProducer);
    socket.on("userLeft", handleUserLeft);
    socket.on("userUpdated", handleUserUpdated);

    const cleanupNewScreenShare = onNewScreenShare(handleNewScreenShare);
    const cleanupScreenShareStopped = onScreenShareStopped(
      handleScreenShareStopped
    );

    return () => {
      socket.off("newProducer", handleNewProducer);
      socket.off("userLeft", handleUserLeft);
      cleanupNewScreenShare();
      cleanupScreenShareStopped();
    };
  }, [
    socket,
    joined,
    consumeAndAddTrack,
    deviceRef,
    onNewScreenShare,
    onScreenShareStopped,
    consume,
  ]);

  const handleJoin = async () => {
    if (!roomId || !socket || !userId) return;

    try {
      const roomResponse = await fetch(`/api/rooms/${roomId}`);

      if (!roomResponse.ok) {
        const createResponse = await fetch("/api/rooms/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: `Room ${roomId}` }),
        });

        if (!createResponse.ok) {
          throw new Error("Failed to create room");
        }

        const { room } = await createResponse.json();
        setRoomId(room.id);
        setRoomData(room);
      } else {
        const { room } = await roomResponse.json();
        setRoomData(room);
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      localStreamRef.current = stream;
      setLocalStream?.(stream);

      const { producers: existingProducers } = await joinRoom(roomId, userId);

      const rtpCapabilities = await new Promise((resolve) => {
        socket.emit("getRouterRtpCapabilities", {}, resolve);
      });

      const mediasoupDevice = await loadDevice(rtpCapabilities as any);
      const transport = await createSendTransport();
      setSendTransport(transport as Transport);
      await createRecvTransport();
      await produce(stream);

      setJoined(true);

      for (const { producerId, userId, kind } of existingProducers) {
        await consumeAndAddTrack({
          producerId,
          userId,
          kind,
          device: mediasoupDevice,
        });
      }

      socket.emit("getActiveScreenShares", {}, (screenShares: any[]) => {
        if (screenShares && screenShares.length > 0) {
          console.log("Active screen shares in room:", screenShares);

          screenShares.forEach(async ({ producerId, userId }) => {
            if (consumedProducersRef.current.has(producerId)) return;

            await consume(
              producerId,
              mediasoupDevice.rtpCapabilities,
              (stream: MediaStream) => {
                consumedProducersRef.current.add(producerId);

                setScreenShares((prev) => ({
                  ...prev,
                  [userId]: stream,
                }));
              }
            );
          });
        }
      });
    } catch (error) {
      console.error("Error joining room:", error);
      toast.error("Failed to join room");
      setJoined(false);
    }
  };

  const handleLeaveRoom = () => {
    if (!socket) return;

    socket.emit("leaveRoom");
    setJoined(false);
    window.location.reload();
    router.push("/");
  };

  useEffect(() => {
    const initializeMedia = async () => {
      const stream = await loadMediaDevices({ audio: true, video: true });
      setLocalStream?.(stream);
    };
    initializeMedia();
  }, [setLocalStream]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <div className="flex w-full max-w-screen-lg flex-col items-center justify-center gap-4 p-4">
        <div className="flex w-full flex-col items-center gap-4">
          <h1 className="text-2xl">Call Device setup</h1>
          <p>Prepare your audio and video setup before connecting.</p>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="flex items-center gap-2">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75"></span>
                <span className="relative inline-flex h-full w-full rounded-full bg-green-500"></span>
              </span>
              <span>Live</span>
            </Badge>
            <Badge variant="outline">20 others in the call</Badge>
          </div>
          <div className="flex w-full max-w-2xl flex-col items-center gap-4">
            <div className="h-96 w-full overflow-hidden rounded-md border-2">
              <div className="flex h-full w-full flex-col items-center justify-center gap-4">
                <video
                  ref={videoRef}
                  className="h-full w-full object-cover"
                  autoPlay
                  muted
                  playsInline
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant={cameraEnabled ? "outline" : "destructive"}
                onClick={toggleCamera}
              >
                <CameraIcon className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant={micEnabled ? "outline" : "destructive"}
                onClick={toggleMic}
              >
                <MicIcon className="h-4 w-4" />
              </Button>
              <Button className="w-full" onClick={handleJoin}>
                Join call
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoomPage;
