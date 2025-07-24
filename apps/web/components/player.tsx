import { Camera, CameraOff, Mic, MicOff, User } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "@call/ui/lib/utils";

interface PlayerProps {
  stream: MediaStream;
  name: string;
  you?: boolean;
  audioStream?: MediaStream;
  isScreenShare?: boolean;
  micActive?: boolean;
  camActive?: boolean;
  isShareScreen?: boolean;
  className?: string;
}

const Player = ({
  stream,
  name,
  you = false,
  audioStream,
  isScreenShare = false,
  micActive = false,
  camActive = false,
  className,
}: PlayerProps) => {
  console.log({
    you,
    name,
    micActive,
    camActive,
    isScreenShare,
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;

      if (isScreenShare) {
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
              console.log(
                "Screen share resolution changed:",
                entry.contentRect
              );
            }
          });

          resizeObserver.observe(videoRef.current);

          return () => {
            resizeObserver.disconnect();
          };
        }
      }
    }
  }, [stream, isScreenShare]);

  useEffect(() => {
    if (audioRef.current && audioStream) {
      audioRef.current.srcObject = audioStream;
      audioRef.current.play().catch((error) => {
        console.error("Error playing audio:", error);
      });
    }
  }, [audioStream]);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg",
        isScreenShare ? "col-span-2" : "",
        className
      )}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={you}
        className={cn(
          "h-full w-full rounded-lg bg-black object-cover shadow-lg",
          isScreenShare && "object-contain"
        )}
      />
      {audioStream && <audio ref={audioRef} autoPlay playsInline />}
      {/* {you ? null : camActive ? null : (
        <div className="absolute inset-0 z-50 flex h-full w-full items-center justify-center bg-black">
          <div className="bg-background/10 flex size-20 items-center justify-center rounded-full">
            <User className="size-10 text-white" />
          </div>
        </div>
      )} */}
      <div
        className={cn(
          "absolute bottom-0 left-0 flex w-full items-center justify-between px-2 py-1 text-sm text-white",
          isScreenShare ? "bg-blue-500/70" : "bg-black/50"
        )}
      >
        <span className="flex items-center gap-2">
          {isScreenShare ? "📺 " : ""}
          {name}
        </span>
        <span className="flex items-center gap-2">
          {you ? null : (
            <>
              {micActive ? (
                <Mic className="size-4" />
              ) : (
                <MicOff className="size-4" />
              )}
            </>
          )}
        </span>
      </div>
    </div>
  );
};

export default Player;
