import { auth } from "@call/auth/auth";
import { env } from "./config/env.js";
import { cors } from "hono/cors";
import { db } from "@call/db";
import routes from "./routes/index.js";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";
import chalk from "chalk";
import { networkInterfaces } from "os";
import { Server as SocketIOServer } from "socket.io";
import { socketIoConnection } from "./lib/ws.ts";
import { createWorkers } from "./lib/worker.ts";

export interface ReqVariables {
  user: typeof auth.$Infer.Session.user | null;
  session: typeof auth.$Infer.Session.session | null;
  db: typeof db | null;
}

const app = new Hono<{ Variables: ReqVariables }>();

app.use("*", logger());

// Improved CORS configuration
const allowedOrigins = [
  env.FRONTEND_URL,
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
];

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return "*";
      return allowedOrigins.includes(origin) ? origin : null;
    },
    credentials: true,
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
    ],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    exposeHeaders: ["Set-Cookie"],
    maxAge: 86400,
  })
);

app.use("*", async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    c.set("db", null);
    c.set("user", null);
    c.set("session", null);
    return next();
  }

  c.set("db", db);
  c.set("user", session.user);
  c.set("session", session.session);
  return next();
});

app.route("/api", routes);

const port = env.PORT || 1284;

// Get network IP address
const getNetworkIP = () => {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "127.0.0.1";
};

const logServerStart = (port: number) => {
  const networkIP = getNetworkIP();

  console.log(chalk.cyan("\nServer Starting..."));
  console.log(chalk.gray("━".repeat(50)));
  console.log(chalk.green(`Server running on port ${port}`));
  console.log(chalk.blue(`Local: http://localhost:${port}`));
  console.log(chalk.blue(`Network: http://${networkIP}:${port}`));
  console.log(chalk.gray("━".repeat(50)));
  console.log(chalk.yellow("Press Ctrl+C to stop\n"));
};

const startServerWithEventHandling = async (
  startPort: number,
  maxAttempts: number = 50
): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    let currentPort = startPort;
    let attempts = 0;

    // Initialize mediasoup workers first
    try {
      console.log(chalk.blue("🔧 Initializing mediasoup workers..."));
      await createWorkers();
      console.log(chalk.green("✅ Mediasoup workers initialized"));
    } catch (error) {
      console.error(
        chalk.red("❌ Failed to initialize mediasoup workers:"),
        error
      );
      reject(error);
      return;
    }

    const tryPort = () => {
      if (attempts >= maxAttempts) {
        reject(
          new Error(`Could not start server after ${maxAttempts} attempts`)
        );
        return;
      }

      try {
        const server = serve({
          fetch: app.fetch,
          port: currentPort,
          hostname: "0.0.0.0",
        });

        const io = new SocketIOServer(server);

        console.log(chalk.blue("🔌 Setting up Socket.IO connection..."));

        socketIoConnection(io);

        io.on("connection", (socket) => {
          console.log(
            chalk.green(`✅ Socket.IO client connected: ${socket.id}`)
          );

          socket.on("disconnect", () => {
            console.log(
              chalk.yellow(`❌ Socket.IO client disconnected: ${socket.id}`)
            );
          });
        });

        app.get("/health", (c) => {
          return c.json({
            status: "ok",
            timestamp: new Date().toISOString(),
            socketIo: "connected",
            port: currentPort,
          });
        });

        server.once("error", (error: any) => {
          if (error.code === "EADDRINUSE") {
            attempts++;
            currentPort++;
            console.log(
              chalk.yellow(
                `Port ${currentPort - 1} is busy, trying ${currentPort}...`
              )
            );
            tryPort();
          } else {
            reject(error);
          }
        });

        process.nextTick(() => {
          if (currentPort !== startPort) {
            console.log(
              chalk.yellow(
                `Port ${startPort} was busy, using ${currentPort} instead`
              )
            );
          }
          logServerStart(currentPort);
          console.log(
            chalk.green("🎉 Socket.IO server is ready and connected to Hono!")
          );
          resolve();
        });
      } catch (error) {
        reject(error);
      }
    };

    tryPort();
  });
};

startServerWithEventHandling(Number(port)).catch((error) => {
  console.log(chalk.red(`\nFailed to start server: ${error.message}`));
  process.exit(1);
});
