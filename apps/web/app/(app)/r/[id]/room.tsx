"use client";

import MediaControls from "@/components/media-controls";
import Player from "@/components/player";
import { useRoom } from "@/components/providers/room";
import { useSession } from "@/components/providers/session";
import { useUsers } from "@/components/providers/users";
import SetUp from "@/components/rooms/set-up";
import ScreenShareDisplay from "@/components/screenshare-display";
import { useMediaControl } from "@/hooks/use-mediacontrol";
import { useMediasoupClient } from "@/hooks/use-mediasoup";
import { useScreenShare } from "@/hooks/use-screenshare";
import { cn } from "@call/ui/lib/utils";
import { calcSizesAndClasses } from "@/lib/calc-sizes-and-classes";
import { Loader, Users2 } from "lucide-react";
import type { Device } from "mediasoup-client";
import type { AppData, Transport } from "mediasoup-client/types";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { Participant } from "@/lib/types";
import { useMediasoup } from "@/components/providers/mediasoup";

const RoomPage = () => {
  const router = useRouter();
  const { room } = useRoom();
  const { users } = useUsers();
  const { user: currentUser } = useSession();
  const {
    joinRoom,
    loadDevice,
    createSendTransport,
    createRecvTransport,
    produce,
    socket,
    consume,
    deviceRef,
    isScreenSharing,
  } = useMediasoup();

  const {
    localStreamRef,
    videoRef,
    cameraEnabled,
    micEnabled,
    toggleCamera,
    toggleMic,
    loadMediaDevices,
  } = useMediaControl();

  const { onNewScreenShare, onScreenShareStopped } = useScreenShare();

  const [joined, setJoined] = useState(false);
  const consumedProducersRef = useRef<Set<string>>(new Set());
  const [remoteStreams, setRemoteStreams] = useState<
    Record<string, MediaStream>
  >({});

  useEffect(() => {
    const initializeMedia = async () => {
      await loadMediaDevices({ audio: true, video: true });
    };
    initializeMedia();

    console.log("localStreamRef.current", localStreamRef.current);
  }, []);

  const consumeAndAddTrack = useCallback(
    async ({
      producerId,
      userId,
      device,
    }: {
      producerId: string;
      userId: string;
      kind: "audio" | "video" | "screen";
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
    return () => {
      if (sendTransport) {
        sendTransport.close();
      }
    };
  }, [sendTransport]);

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
    if (!socket || !currentUser || !room) return;

    try {
      const { producers: existingProducers } = await joinRoom(
        room.id,
        currentUser.id
      );

      const rtpCapabilities = await new Promise((resolve) => {
        socket.emit("getRouterRtpCapabilities", {}, resolve);
      });
      const mediasoupDevice = await loadDevice(rtpCapabilities as any);
      const transport = await createSendTransport();
      setSendTransport(transport as Transport);

      await createRecvTransport();

      console.log("localStreamRef.current", localStreamRef.current);

      if (!localStreamRef.current) throw new Error("Local stream not found");

      await produce(localStreamRef.current);

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

    if (sendTransport) {
      sendTransport.close();
    }

    socket.emit("leaveRoom");
    setJoined(false);
    window.location.reload();
    router.push("/r");
  };

  const participants = useMemo(() => {
    const list: Participant[] = [];

    if (localStreamRef.current) {
      list.push({
        userId: currentUser?.id || "local",
        name: "You",
        stream: localStreamRef.current,
        type: "local",
        micActive: micEnabled,
        camActive: cameraEnabled,
        you: true,
      });
    }

    Object.entries(remoteStreams).forEach(([userId, stream]) => {
      const user = users.find((u) => u.id === userId);
      list.push({
        userId,
        name: `User ${userId}`,
        stream,
        type: "remote",
        micActive: user?.micActive,
        camActive: user?.camActive,
      });
    });

    Object.entries(screenShares).forEach(([userId, stream]) => {
      list.push({
        userId,
        name: `Screen share from ${userId}`,
        stream,
        type: "screen",
        isScreenSharing: true,
      });
    });

    return list;
  }, [
    localStreamRef.current,
    remoteStreams,
    screenShares,
    users,
    micEnabled,
    cameraEnabled,
  ]);

  if (!room)
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader className="size-6 animate-spin" />
      </div>
    );

  console.log("participants", participants);

  return (
    <>
      {joined ? (
        <div className="flex min-h-screen w-full flex-col">
          <header className="h-16 border-b px-10">
            <div className="mx-auto flex h-full w-full max-w-7xl items-center justify-between">
              <h1 className="text-2xl font-bold">{room.name}</h1>
              <div className="flex items-center gap-2">
                <Users2 className="size-6" />
                <span className="text-xl font-medium">{users.length}</span>
              </div>
            </div>
          </header>
          <div className="flex flex-1 flex-col">
            {(() => {
              const isScreenSharing = Object.keys(screenShares).length > 0;
              const othersSharing = Object.keys(screenShares).length > 0;
              const others = Object.keys(remoteStreams).length;
              const isYou = true; // Current user is always present

              const {
                containerClasses,
                playerClasses,
                screenShareClasses,
                participantsClasses,
              } = calcSizesAndClasses(
                isYou,
                isScreenSharing,
                othersSharing,
                others
              );

              return (
                <div className={cn("flex-1", containerClasses)}>
                  {isScreenSharing && (
                    <div className={screenShareClasses}>
                      <ScreenShareDisplay
                        streams={screenShares}
                        className="h-full"
                      />
                    </div>
                  )}

                  <div className={participantsClasses || containerClasses}>
                    {localStreamRef.current && (
                      <div className={playerClasses}>
                        <Player
                          stream={localStreamRef.current}
                          name="You"
                          you
                          className={playerClasses}
                        />
                      </div>
                    )}
                    {Object.entries(remoteStreams).map(([userId, stream]) => {
                      const user = users.find((u) => u.id === userId);

                      return (
                        <div key={userId} className={playerClasses}>
                          <Player
                            stream={stream}
                            name={`User ${userId}`}
                            micActive={user?.micActive}
                            camActive={user?.camActive}
                            isShareScreen={user?.isShareScreen}
                            you={false}
                            className={playerClasses}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>

          {joined && localStreamRef.current && (
            <MediaControls
              localStream={localStreamRef.current}
              sendTransport={sendTransport as Transport<AppData>}
              handleLeaveRoom={handleLeaveRoom}
            />
          )}
        </div>
      ) : (
        <div>
          <SetUp
            onJoin={handleJoin}
            cameraEnabled={cameraEnabled}
            micEnabled={micEnabled}
            toggleCamera={toggleCamera}
            toggleMic={toggleMic}
            videoRef={videoRef as React.RefObject<HTMLVideoElement>}
          />
        </div>
      )}
    </>
  );
};

export default RoomPage;
