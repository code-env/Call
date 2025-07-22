import * as mediasoup from "mediasoup";
import { config } from "@/config/mediasoup";
import type { Worker } from "mediasoup/types";
import os from "os";

const workers: Worker[] = [];
let nextWorkerIndex = 0;

export const createWorkers = async (): Promise<void> => {
  const numWorkers = os.cpus().length;

  // creating a pool of workers based upon the cpus
  // later on this can be distributed among rooms/routers
  // I don't know maybe some optimisation if a worker died for some reason

  for (let i = 0; i < numWorkers; i++) {
    const worker = await mediasoup.createWorker({
      logLevel: config.mediasoup.workerSettings.logLevel,
      logTags: config.mediasoup.workerSettings.logTags,
      rtcMinPort: config.mediasoup.workerSettings.rtcMinPort,
      rtcMaxPort: config.mediasoup.workerSettings.rtcMaxPort,
    });

    worker.on("died", () => {
      console.error("mediasoup worker died", worker.pid);
      setTimeout(() => {
        process.exit(1);
      }, 2000);
    });

    workers.push(worker);

    console.log(`Created mediasoup worker #${i} [pid:${worker.pid}]`);
  }
};

export const getMediasoupWorker = (): Worker => {
  const worker = workers[nextWorkerIndex];
  nextWorkerIndex = (nextWorkerIndex + 1) % workers.length;
  return worker!;
};
