import { useState, useEffect, useRef } from "react";
import { Button } from "@call/ui/components/button";
import { useScreenShare } from "@/hooks/use-screenshare";
import { Transport } from "mediasoup-client/types";
import { toast } from "sonner";
import { useSocket } from "@/components/providers/socket";

interface MediaControlsProps {
  localStream: MediaStream | null;
  sendTransport?: Transport;
}

const MediaControls = ({ localStream, sendTransport }: MediaControlsProps) => {
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const { socket, connected } = useSocket();
  const localStreamRef = useRef<MediaStream | null>(null);

  const {
    isScreenSharing,
    startScreenShare,
    stopScreenShare,
    error: screenShareError,
  } = useScreenShare();

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    if (screenShareError) {
      console.error("Screen share error:", screenShareError);
      toast.error(screenShareError, {
        description: "Please try again or use a different window/application",
        duration: 5000,
      });
    }
  }, [screenShareError]);

  const toggleCamera = () => {
    if (!connected || !socket) return;
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !isCameraOn;
      });
      setIsCameraOn((prev) => !prev);
      socket.emit("updateUser", {
        userId: socket.id,
        micActive: isMicOn,
        camActive: !isCameraOn,
        isShareScreen: isScreenSharing,
      });
    }
  };

  const toggleMic = () => {
    if (!connected || !socket) return;
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !isMicOn;
      });
      setIsMicOn((prev) => !prev);
      socket.emit("updateUser", {
        userId: socket.id,
        micActive: !isMicOn,
        camActive: isCameraOn,
        isShareScreen: isScreenSharing,
      });
    }
  };

  const handleScreenShare = async () => {
    if (!sendTransport) {
      console.error("Send transport not available");
      return;
    }

    if (isScreenSharing) {
      stopScreenShare();
    } else {
      await startScreenShare(sendTransport);
    }
  };

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 gap-4 rounded-lg">
      <Button
        variant={isCameraOn ? "default" : "outline"}
        onClick={toggleCamera}
      >
        {isCameraOn ? "Turn Camera Off" : "Turn Camera On"}
      </Button>
      <Button variant={isMicOn ? "default" : "outline"} onClick={toggleMic}>
        {isMicOn ? "Mute Mic" : "Unmute Mic"}
      </Button>
      <Button
        variant={isScreenSharing ? "destructive" : "default"}
        onClick={handleScreenShare}
        disabled={!sendTransport}
        className={
          isScreenSharing ? "relative bg-red-500 hover:bg-red-600" : "relative"
        }
      >
        {isScreenSharing ? (
          <>
            <span className="absolute -right-2 -top-2 h-3 w-3 animate-pulse rounded-full bg-red-500"></span>
            Stop Sharing
          </>
        ) : (
          "Share Screen"
        )}
      </Button>
    </div>
  );
};

export default MediaControls;
