import * as mediasoup from "mediasoup";
import type { Router, Worker } from "mediasoup/types";
import os from "os";
import { config } from "@/config/mediasoup";

export async function startMediasoup() {
  const workers: Array<{
    worker: Worker;
    router: Router;
  }> = [];

  for (let i = 0; i < os.cpus().length; i++) {
    const worker = await mediasoup.createWorker({
      logLevel: config.mediasoup.workerSettings.logLevel,
      logTags: config.mediasoup.workerSettings.logTags,
      rtcMinPort: config.mediasoup.workerSettings.rtcMinPort,
      rtcMaxPort: config.mediasoup.workerSettings.rtcMaxPort,
    });

    worker.on("died", () => {
      console.error("mediasoup worker died (this should never happen)");
      process.exit(1);
    });

    const mediaCodecs = config.mediasoup.router.mediaCodecs;
    const router = await worker.createRouter({ mediaCodecs });

    workers.push({ worker, router });
  }

  return workers;
}
