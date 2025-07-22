import { useCallback, useRef, useState, useEffect } from "react";
import type { Producer, Transport } from "mediasoup-client/types";
import { useSocket } from "@/components/providers/socket";
import { useNetworkMonitor } from "@/hooks/use-network-monitor";

export function useScreenShare() {
  const { socket, connected } = useSocket();

  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenShareStream, setScreenShareStream] =
    useState<MediaStream | null>(null);
  const screenShareProducerRef = useRef<Producer | null>(null);
  const [error, setError] = useState<string | null>(null);

  const networkStats = useNetworkMonitor();

  const startScreenShare = useCallback(
    async (sendTransport: Transport) => {
      if (!socket || !connected) {
        setError("Socket not connected");
        return null;
      }

      try {
        setError(null);

        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 },
            ...({
              cursor: "always",
              displaySurface: "monitor",
            } as any),
          },
          audio: false,
        });

        setScreenShareStream(stream);

        const track = stream.getVideoTracks()[0];

        track?.addEventListener("ended", () => {
          console.log("Screen share track ended by browser UI");
          stopScreenShare();
        });

        track?.addEventListener("mute", () => {
          console.log("Screen share track muted");
        });

        track?.addEventListener("unmute", () => {
          console.log("Screen share track unmuted");
        });

        track?.addEventListener("error", (event) => {
          console.error("Screen share track error:", event);
          setError("Screen sharing encountered an error. Stopping share.");
          stopScreenShare();
        });

        const detectContentType = (track: MediaStreamTrack) => {
          const settings = track.getSettings();
          const frameRate = settings.frameRate || 30;

          if (frameRate > 25) return "dynamic";
          if (frameRate < 10) return "static";
          return "mixed";
        };

        const contentType = detectContentType(track as MediaStreamTrack);
        console.log(`Detected screen share content type: ${contentType}`);

        const screenShareProducer = await sendTransport.produce({
          track,
          encodings:
            contentType === "static"
              ? [
                  {
                    maxBitrate: 1000000,
                    maxFramerate: 5,
                  },
                ]
              : [
                  {
                    maxBitrate: 3000000,
                    maxFramerate: 30,
                  },
                ],
          codecOptions: {
            videoGoogleStartBitrate: 1000,
          },
          appData: {
            mediaType: "screenShare",
            contentType: contentType,
          },
        });

        screenShareProducerRef.current = screenShareProducer;

        console.log("screenShareProducer", screenShareProducer);

        socket.emit(
          "startScreenShare",
          {
            transportId: sendTransport.id,
            rtpParameters: screenShareProducer.rtpParameters,
          },
          (response: { id?: string; error?: string; codecOptions?: any }) => {
            if (response.error) {
              console.error("Error starting screen share:", response.error);
              setError(response.error);
              stopScreenShare();
            } else {
              console.log("Screen share started successfully:", response.id);
              setIsScreenSharing(true);
            }
          }
        );

        return screenShareProducer;
      } catch (error) {
        console.log("error", error);
        if ((error as Error).name === "NotAllowedError") {
          console.log("User denied screen sharing permission");
          setError("Screen sharing permission denied");
        } else {
          console.error("Error starting screen share:", error);
          setError(
            `Failed to start screen sharing: ${(error as Error).message}`
          );
        }
        return null;
      }
    },
    [socket, connected]
  );

  // Stop screen sharing
  const stopScreenShare = useCallback(() => {
    if (!socket || !connected) {
      setError("Socket not connected");
      return;
    }

    try {
      // Close the screen share producer if it exists
      if (screenShareProducerRef.current) {
        screenShareProducerRef.current.close();

        // Notify the server that screen sharing has stopped
        socket.emit(
          "stopScreenShare",
          {},
          (response: { stopped?: boolean; error?: string }) => {
            if (response.error) {
              console.error("Error stopping screen share:", response.error);
            } else {
              console.log("Screen share stopped successfully");
            }
          }
        );
      }

      // Stop all tracks in the screen share stream
      if (screenShareStream) {
        screenShareStream.getTracks().forEach((track) => track.stop());
      }

      // Reset state
      setScreenShareStream(null);
      screenShareProducerRef.current = null;
      setIsScreenSharing(false);
      setError(null);
    } catch (error) {
      console.error("Error stopping screen share:", error);
      setError(`Failed to stop screen sharing: ${(error as Error).message}`);
    }
  }, [socket, connected, screenShareStream]);

  // Get active screen shares in the room
  const getActiveScreenShares = useCallback(() => {
    return new Promise<
      Array<{ userId: string; producerId: string; kind: string; appData: any }>
    >((resolve, reject) => {
      if (!socket || !connected) {
        setError("Socket not connected");
        reject(new Error("Socket not connected"));
        return;
      }

      socket.emit(
        "getActiveScreenShares",
        {},
        (
          screenShares: Array<{
            userId: string;
            producerId: string;
            kind: string;
            appData: any;
          }>
        ) => {
          resolve(screenShares);
        }
      );
    });
  }, [socket, connected]);

  // Listen for new screen shares
  const onNewScreenShare = useCallback(
    (
      callback: (data: {
        producerId: string;
        userId: string;
        appData: any;
      }) => void
    ) => {
      if (!socket) return () => {};

      socket.on("newScreenShare", callback);
      return () => {
        socket.off("newScreenShare", callback);
      };
    },
    [socket]
  );

  // Listen for screen share stopped events
  const onScreenShareStopped = useCallback(
    (callback: (data: { userId: string }) => void) => {
      if (!socket) return () => {};

      socket.on("screenShareStopped", callback);
      return () => {
        socket.off("screenShareStopped", callback);
      };
    },
    [socket]
  );

  // Monitor network conditions and adapt screen share quality
  useEffect(() => {
    if (isScreenSharing && screenShareProducerRef.current) {
      // Adapt quality based on network conditions
      const producer = screenShareProducerRef.current;

      console.log("Network quality changed:", networkStats.quality);

      // Adjust producer parameters based on network quality
      if (producer.setMaxSpatialLayer) {
        try {
          switch (networkStats.quality) {
            case "low":
              // Use lowest quality layer
              producer.setMaxSpatialLayer(0);
              console.log(
                "Set screen share to low quality due to network conditions"
              );
              break;
            case "medium":
              // Use medium quality layer
              producer.setMaxSpatialLayer(1);
              console.log(
                "Set screen share to medium quality due to network conditions"
              );
              break;
            case "high":
              // Use highest quality layer
              producer.setMaxSpatialLayer(2);
              console.log(
                "Set screen share to high quality due to network conditions"
              );
              break;
          }
        } catch (error) {
          console.error("Error adjusting screen share quality:", error);
        }
      }
    }
  }, [networkStats.quality, isScreenSharing]);

  return {
    isScreenSharing,
    screenShareStream,
    error,
    startScreenShare,
    stopScreenShare,
    getActiveScreenShares,
    onNewScreenShare,
    onScreenShareStopped,
  };
}
