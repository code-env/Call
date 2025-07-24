"use client";

import { Badge } from "@call/ui/components/badge";
import { Button } from "@call/ui/components/button";
import { CameraIcon, MicIcon } from "lucide-react";
import { useControls } from "../providers/controls";
import { useEffect } from "react";

type SetUpProps = {
  onJoin: () => void;
};

const SetUp = ({ onJoin }: SetUpProps) => {
  const { loadMediaDevices } = useControls();

  useEffect(() => {
    const initializeMedia = async () => {
      await loadMediaDevices({ audio: true, video: true });
    };
    initializeMedia();

    console.log("localStreamRef.current", localStreamRef.current);
  }, []);

  const {
    videoRef,
    cameraEnabled,
    micEnabled,
    toggleCamera,
    toggleMic,
    localStreamRef,
  } = useControls();
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
              <Button className="w-full" onClick={onJoin}>
                Join call
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetUp;
