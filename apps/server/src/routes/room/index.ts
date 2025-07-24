import { zValidator } from "@hono/zod-validator";
import { createRoomSchema } from "@/validators";
import type { Context } from "hono";
import { Hono } from "hono";
import { db } from "@call/db";
import { room as roomTable, roomUser as roomUserTable } from "@call/db/schema";
import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import type { ReqVariables } from "../../index.js";

const roomRouter = new Hono<{ Variables: ReqVariables }>();

function generateJoinCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

roomRouter.post(
  "/create",
  zValidator("json", createRoomSchema),
  async (c: Context) => {
    try {
      const { name } = await c.req.json();

      // Get authenticated user
      const user = c.get("user");
      if (!user || !user.id) {
        return c.json({ message: "Unauthorized" }, 401);
      }

      // Generate unique room ID and join code
      const roomId = createId();
      let joinCode = generateJoinCode();
      let exists = true;

      // Ensure join code is unique
      while (exists) {
        joinCode = generateJoinCode();
        const found = await db
          .select()
          .from(roomTable)
          .where(eq(roomTable.joinCode, joinCode));
        exists = found.length > 0;
      }

      // Create room in database
      await db.insert(roomTable).values({
        id: roomId,
        name,
        joinCode: joinCode,
        requireAccessBeforeJoining: false,
        users: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return c.json({
        success: true,
        message: "Room created successfully",
        room: {
          id: roomId,
          name,
          joinCode: joinCode,
        },
      });
    } catch (err) {
      console.error("Error creating room:", err);
      return c.json(
        {
          success: false,
          message: "Failed to create room.",
        },
        500
      );
    }
  }
);

// Get room by join code
roomRouter.get("/join/:joinCode", async (c: Context) => {
  try {
    const { joinCode } = c.req.param();

    if (!joinCode) {
      return c.json({ message: "Join code is required" }, 400);
    }

    const room = await db
      .select()
      .from(roomTable)
      .where(eq(roomTable.joinCode, joinCode))
      .limit(1);

    if (room.length === 0) {
      return c.json({ message: "Room not found" }, 404);
    }

    return c.json({
      success: true,
      room: room[0],
    });
  } catch (err) {
    console.error("Error fetching room:", err);
    return c.json(
      {
        success: false,
        message: "Failed to fetch room.",
      },
      500
    );
  }
});

roomRouter.get("/:roomId", async (c: Context) => {
  try {
    const { roomId } = c.req.param();

    if (!roomId) {
      return c.json({ message: "Room ID is required" }, 400);
    }

    const room = await db
      .select()
      .from(roomTable)
      .where(eq(roomTable.id, roomId))
      .limit(1);

    if (room.length === 0) {
      return c.json({ message: "Room not found" }, 404);
    }

    return c.json({
      success: true,
      room: room[0],
    });
  } catch (err) {
    console.error("Error fetching room:", err);
    return c.json(
      {
        success: false,
        message: "Failed to fetch room.",
      },
      500
    );
  }
});

roomRouter.get("/:roomId/users", async (c: Context) => {
  const { roomId } = c.req.param();

  if (!roomId) {
    return c.json({ message: "Room ID is required" }, 400);
  }

  const users = await db
    .select()
    .from(roomUserTable)
    .where(eq(roomUserTable.roomId, roomId));

  return c.json({
    success: true,
    users,
  });
});

export default roomRouter;
