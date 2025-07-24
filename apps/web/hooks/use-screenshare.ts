import { useMediasoup } from "@/components/providers/mediasoup";
import { useSocket } from "@/components/providers/socket";
import { useNetworkMonitor } from "@/hooks/use-network-monitor";
import type { Producer } from "mediasoup-client/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export function useScreenShare() {
  const { socket } = useSocket();
  const { createScreenSendTransport, screenSendTransportRef } = useMediasoup();

  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenShareStream, setScreenShareStream] =
    useState<MediaStream | null>(null);
  const screenShareProducerRef = useRef<Producer | null>(null);

  const networkStats = useNetworkMonitor();

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

      console.log("screnshareStream", stream);

      screenShareProducerRef.current = screenProducer;

      setScreenShareStream(stream);
      setIsScreenSharing(true);
      console.log("Screen share producer created:", screenProducer.id);
    } catch (err) {
      console.error("Error starting screen share:", err);
      toast.error((err as Error).message);
    }
  }, [createScreenSendTransport, socket]);

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

  useEffect(() => {
    if (isScreenSharing && screenShareProducerRef.current) {
      const producer = screenShareProducerRef.current;

      console.log("Network quality changed:", networkStats.quality);

      if (producer.setMaxSpatialLayer) {
        try {
          switch (networkStats.quality) {
            case "low":
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
    startScreenShare,
    stopScreenShare,
    onNewScreenShare,
    onScreenShareStopped,
  };
}
