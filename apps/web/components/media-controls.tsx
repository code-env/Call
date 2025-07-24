import { useState, useEffect, useRef } from "react";
import { Button } from "@call/ui/components/button";
import { useScreenShare } from "@/hooks/use-screenshare";
import { Transport } from "mediasoup-client/types";
import { toast } from "sonner";
import { useSocket } from "@/components/providers/socket";
import {
  CameraIcon,
  CameraOffIcon,
  MicIcon,
  MicOffIcon,
  MonitorOff,
  MonitorUp,
  PhoneIcon,
  Share2Icon,
} from "lucide-react";

interface MediaControlsProps {
  localStream: MediaStream | null;
  sendTransport?: Transport;
  handleLeaveRoom: () => void;
}

const MediaControls = ({
  localStream,
  sendTransport,
  handleLeaveRoom,
}: MediaControlsProps) => {
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
    <div className="fixed bottom-0 flex h-16 w-full items-center justify-center gap-4 p-4">
      <div className="absolute -top-1 h-px w-full bg-[linear-gradient(to_right,var(--background),var(--muted)_200px,var(--muted)_calc(100%-200px),var(--background))]" />
      <div className="flex items-center gap-4">
        <Button
          variant={isCameraOn ? "default" : "outline"}
          onClick={toggleCamera}
          size="icon"
        >
          {isCameraOn ? (
            <CameraOffIcon className="h-4 w-4" />
          ) : (
            <CameraIcon className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant={isMicOn ? "default" : "outline"}
          onClick={toggleMic}
          size="icon"
        >
          {isMicOn ? (
            <MicOffIcon className="h-4 w-4" />
          ) : (
            <MicIcon className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant={isScreenSharing ? "destructive" : "default"}
          onClick={handleScreenShare}
          disabled={!sendTransport}
          className={
            isScreenSharing
              ? "bg-destructive hover:bg-destructive/90 relative"
              : "relative"
          }
          size="icon"
        >
          {isScreenSharing ? (
            <MonitorOff className="h-4 w-4" />
          ) : (
            <MonitorUp className="h-4 w-4" />
          )}
        </Button>
        <Button variant="destructive" size="icon" onClick={handleLeaveRoom}>
          <PhoneIcon className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default MediaControls;
