import { useSocket } from "@/components/providers/socket";
import { useScreenShare } from "@/hooks/use-screenshare";
import { Button } from "@call/ui/components/button";
import {
  CameraIcon,
  CameraOffIcon,
  MicIcon,
  MicOffIcon,
  MonitorOff,
  MonitorUp,
  PhoneIcon,
} from "lucide-react";
import { Transport } from "mediasoup-client/types";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface MediaControlsProps {
  localStream: MediaStream | null;
  sendTransport?: Transport;
  startScreenShare?: () => Promise<void> | null;
  stopScreenShare?: () => void;
  isScreenSharing?: boolean;
  handleLeaveRoom: () => void;
}

export default function MediaControls({
  localStream,
  handleLeaveRoom,
}: MediaControlsProps) {
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const localStreamRef = useRef<MediaStream | null>(null);
  const { startScreenShare, stopScreenShare, isScreenSharing } =
    useScreenShare();

  const { socket, connected } = useSocket();

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  const updateSocketState = (cam = isCameraOn, mic = isMicOn) => {
    if (!socket || !connected) return;
    socket.emit("updateUser", {
      userId: socket.id,
      micActive: mic,
      camActive: cam,
      isShareScreen: isScreenSharing,
    });
  };

  const toggleCamera = () => {
    if (!localStreamRef.current) return;

    localStreamRef.current.getVideoTracks().forEach((track) => {
      track.enabled = !isCameraOn;
    });
    const newCamState = !isCameraOn;
    setIsCameraOn(newCamState);
    updateSocketState(newCamState, isMicOn);
  };

  const toggleMic = () => {
    if (!localStreamRef.current) return;

    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = !isMicOn;
    });
    const newMicState = !isMicOn;
    setIsMicOn(newMicState);
    updateSocketState(isCameraOn, newMicState);
  };

  const handleScreenShare = async () => {
    if (isScreenSharing) {
      stopScreenShare();
    } else {
      try {
        await startScreenShare();
      } catch (err) {
        console.error("Error starting screen share:", err);
        toast.error("Failed to start screen sharing");
      }
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
          disabled={!startScreenShare || !stopScreenShare}
          className={
            isScreenSharing ? "bg-destructive hover:bg-destructive/90" : ""
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
}
