import { useEffect, useRef, useState } from "react";
import { cn } from "@call/ui/lib/utils";

interface ScreenShareDisplayProps {
  streams: Record<string, MediaStream>;
  onSelect?: (userId: string) => void;
  className?: string;
}

const ScreenShareDisplay = ({
  streams,
  onSelect,
  className,
}: ScreenShareDisplayProps) => {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamEntries = Object.entries(streams);

  useEffect(() => {
    if (streamEntries.length > 0 && !selectedUserId) {
      setSelectedUserId(streamEntries[0]?.[0] || null);
    } else if (streamEntries.length === 0) {
      setSelectedUserId(null);
    } else if (selectedUserId && !streams[selectedUserId]) {
      setSelectedUserId(streamEntries[0]?.[0] || null);
    }
  }, [streams, selectedUserId]);

  useEffect(() => {
    if (videoRef.current && selectedUserId && streams[selectedUserId]) {
      const stream = streams[selectedUserId];
      videoRef.current.srcObject = stream;

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const resizeObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
            console.log("Screen share video size changed:", entry.contentRect);
          }
        });

        resizeObserver.observe(videoRef.current);

        return () => {
          resizeObserver.disconnect();
        };
      }
    }
  }, [selectedUserId, streams]);

  const handleSelectStream = (userId: string) => {
    setSelectedUserId(userId);
    if (onSelect) {
      onSelect(userId);
    }
  };

  if (streamEntries.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex w-full flex-col", className)}>
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-lg bg-black",
          className?.includes("h-full") && "h-full"
        )}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="h-full w-full object-contain"
        />
        {selectedUserId && (
          <div className="absolute bottom-4 left-4 rounded-md bg-blue-500/70 px-3 py-1.5 text-white">
            📺 {selectedUserId}'s Screen
          </div>
        )}
      </div>

      {streamEntries.length > 1 && (
        <div className="mt-2 flex gap-2 overflow-x-auto p-2">
          {streamEntries.map(([userId, stream]) => {
            const thumbVideoRef = useRef<HTMLVideoElement>(null);
            useEffect(() => {
              if (thumbVideoRef.current) {
                thumbVideoRef.current.srcObject = stream;
              }
            }, [stream]);
            return (
              <div
                key={userId}
                className={`relative cursor-pointer transition-all ${
                  selectedUserId === userId
                    ? "scale-105 border-2 border-blue-500"
                    : "border border-gray-300 opacity-80 hover:opacity-100"
                }`}
                onClick={() => handleSelectStream(userId)}
              >
                <video
                  ref={thumbVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-[120px] w-[213px] rounded object-cover"
                />
                <div className="absolute bottom-1 left-1 right-1 truncate rounded bg-black/60 px-1 py-0.5 text-xs text-white">
                  {userId}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ScreenShareDisplay;
