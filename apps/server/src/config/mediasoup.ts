import type {
  RtpCodecCapability,
  TransportListenInfo,
  WorkerLogTag,
} from "mediasoup/types";
import os from "os";

export const config = {
  listenIp: "0.0.0.0",
  listenPort: 3016,
  mediasoup: {
    numWorkers: Object.keys(os.cpus()).length,
    workerSettings: {
      logLevel: "debug",
      logTags: ["info", "ice", "dtls", "rtp", "srtp", "rtcp"] as WorkerLogTag[],
      rtcMinPort: 10000,
      rtcMaxPort: 10100,
    },
    router: {
      mediaCodecs: [
        {
          kind: "audio",
          mimeType: "audio/opus",
          clockRate: 48000,
          channels: 2,
        },
        {
          kind: "video",
          mimeType: "video/VP8",
          clockRate: 90000,
          parameters: {
            "x-google-start-bitrate": 1000,
          },
        },
      ] as RtpCodecCapability[],
    },
    webRtcTransport: {
      listenIps: [
        {
          ip: "0.0.0.0",
          announcedIp: "127.0.0.1",
        },
      ] as TransportListenInfo[],
      maxIncomingBitrate: 1500000,
      initialAvailableOutgoingBitrate: 1000000,
        },
    screenSharing: {
      encodings: [
        {
          rid: "high",
          maxBitrate: 5000000,
          maxFramerate: 30,
          priority: "high",
          networkPriority: "high",
          adaptivePtime: true,
          scalabilityMode: "L1T3",
          scaleResolutionDownBy: 1,
        },
        {
          rid: "medium",
          maxBitrate: 1000000,
          maxFramerate: 15,
          priority: "medium",
          networkPriority: "medium",
          adaptivePtime: true,
          scalabilityMode: "L1T2",
          scaleResolutionDownBy: 2,
        },
        {
          rid: "low",
          maxBitrate: 500000,
          maxFramerate: 8,
          priority: "low",
          networkPriority: "low",
          adaptivePtime: true,
          scalabilityMode: "L1T1",
          scaleResolutionDownBy: 4,
        },
      ],
      codecOptions: {
        videoGoogleStartBitrate: 1000,
        videoGoogleMaxBitrate: 5000,
        videoGoogleMinBitrate: 300,
        videoGoogleStartFrameRate: 15,
        videoGoogleMaxFrameRate: 30,
        videoGoogleMinFrameRate: 8,
      },
      contentHints: {
        static: {
          maxFramerate: 5,
                maxBitrate: 1000000,
        },
        dynamic: {
          maxFramerate: 30,
          maxBitrate: 5000000,
        },
        mixed: {
          maxFramerate: 15,
            maxBitrate: 2500000,
        },
      },
    },
  },
} as const;
