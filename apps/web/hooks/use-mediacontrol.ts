import { useRef, useState } from "react";

export const useMediaControl = () => {
  const localStreamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);

  const loadMediaDevices = async (params: {
    audio: boolean;
    video: boolean;
  }) => {
    const stream = await navigator.mediaDevices.getUserMedia(params);
    localStreamRef.current = stream;

    // Set the stream to the video element
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }

    return stream;
  };

  const toggleCamera = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setCameraEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicEnabled(audioTrack.enabled);
      }
    }
  };

  return {
    localStreamRef,
    videoRef,
    cameraEnabled,
    micEnabled,
    toggleCamera,
    toggleMic,
    loadMediaDevices,
  };
};
