# Room Architecture - Database Integration

## Overview

This document explains how the room system has been restructured to properly integrate the database schema with WebSocket signaling and mediasoup media handling.

## Architecture Components

### 1. Database Schema (`packages/db/src/schema.ts`)

The database uses two main tables for room management:

- **`room`**: Stores room metadata (id, name, joinCode, etc.)
- **`room_user`**: Stores user participation in rooms with media states

### 2. Room Creation Flow

#### HTTP Route (`apps/server/src/routes/room/index.ts`)

```typescript
POST /api/rooms/create
{
  "name": "Room Name"
}
```

**Process:**

1. Validates user authentication
2. Generates unique room ID using `createId()`
3. Generates unique 6-character join code
4. Creates room record in database
5. Returns room data to client

#### WebSocket Integration (`apps/server/src/lib/ws.ts`)

```typescript
socket.on("createRoom", async ({ roomId }, callback) => {
  // Verifies room exists in database
  // Creates mediasoup router if needed
  // Returns success/error
});
```

### 3. Room Joining Flow

#### HTTP Route

```typescript
GET /api/rooms/join/:joinCode
GET /api/rooms/:roomId
```

#### WebSocket Integration

```typescript
socket.on("joinRoom", async ({ roomId, token, userId }, callback) => {
  // Verifies room exists in database
  // Creates mediasoup room if needed
  // Adds user to room_user table
  // Returns existing producers
});
```

### 4. User State Management

#### Database Updates

- **Mic/Camera/Screen Share**: Updates `room_user` table
- **User Leave**: Removes from `room_user` table
- **User Join**: Adds to `room_user` table

#### WebSocket Events

- `updateUser`: Updates user media states
- `getUsersInRoom`: Fetches users from database
- `userLeft`: Broadcasts when user disconnects

## Key Improvements

### 1. Database Persistence

- ✅ Room creation persists to database
- ✅ User joins/leaves tracked in database
- ✅ Media states (mic/camera/screen) stored
- ✅ Room metadata (name, join code) managed

### 2. WebSocket Integration

- ✅ Verifies room exists in database before creating mediasoup room
- ✅ User authentication and authorization
- ✅ Real-time state synchronization
- ✅ Proper cleanup on disconnect

### 3. Error Handling

- ✅ Database connection errors handled
- ✅ Room not found scenarios
- ✅ User not found scenarios
- ✅ Graceful fallbacks

## Usage Examples

### Creating a Room

```javascript
// 1. Create room via HTTP
const response = await fetch("/api/rooms/create", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "My Meeting" }),
});

const { room } = await response.json();
// room = { id: "clx123...", name: "My Meeting", joinCode: "ABC123" }

// 2. Join room via WebSocket
socket.emit("joinRoom", {
  roomId: room.id,
  token: "demo-token",
  userId: "user123",
});
```

### Joining by Code

```javascript
// 1. Get room info by join code
const response = await fetch(`/api/rooms/join/${joinCode}`);
const { room } = await response.json();

// 2. Join via WebSocket
socket.emit("joinRoom", {
  roomId: room.id,
  token: "demo-token",
  userId: "user123",
});
```

## Database Schema Details

### Room Table

```sql
CREATE TABLE room (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  join_code TEXT NOT NULL,
  require_access_before_joining BOOLEAN DEFAULT false,
  users JSONB DEFAULT '[]'
);
```

### Room User Table

```sql
CREATE TABLE room_user (
  id TEXT PRIMARY KEY,
  room_id TEXT REFERENCES room(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES user(id) ON DELETE CASCADE,
  is_mic_active BOOLEAN DEFAULT false,
  is_cam_active BOOLEAN DEFAULT false,
  is_share_screen BOOLEAN DEFAULT false,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);
```

## Mediasoup Integration

The mediasoup components work alongside the database:

1. **Room Creation**: Database room created first, then mediasoup router
2. **User Joining**: Database user added first, then mediasoup peer
3. **Media States**: Database updated for persistence, WebSocket for real-time
4. **Cleanup**: Database cleaned up when user leaves/disconnects

## Security Considerations

- ✅ User authentication required for room creation
- ✅ Room existence verified before WebSocket operations
- ✅ User authorization checked for room access
- ✅ Token-based WebSocket authentication

## Future Enhancements

1. **Room Permissions**: Add role-based access control
2. **Room Settings**: Configurable media constraints
3. **Room History**: Track room usage and statistics
4. **Room Templates**: Pre-configured room types
5. **Room Sharing**: Enhanced invite mechanisms

## Troubleshooting

### Common Issues

1. **Room not found**: Check if room exists in database
2. **User not added**: Verify user exists and room_user insert succeeds
3. **Media state not updating**: Check database update operations
4. **WebSocket disconnects**: Verify cleanup operations complete

### Debug Commands

```bash
# Check room in database
SELECT * FROM room WHERE id = 'room_id';

# Check users in room
SELECT * FROM room_user WHERE room_id = 'room_id';

# Check user media states
SELECT user_id, is_mic_active, is_cam_active, is_share_screen
FROM room_user WHERE room_id = 'room_id';
```
