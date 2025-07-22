# Socket.IO Connection Verification Guide

## Current Setup

Your Socket.IO server is already properly connected to your Hono instance. Here's how it works:

1. **Hono Server**: Created using `serve()` with `app.fetch`
2. **Socket.IO Integration**: Attached to the same server instance
3. **WebSocket Handlers**: Set up via `socketIoConnection(io)`

## Verification Methods

### 1. Server Logs

When you start the server, you should see these logs:

```
🔌 Setting up Socket.IO connection...
🔧 Initializing Socket.IO connection handlers...
🔄 Creating mediasoup worker...
✅ Mediasoup worker created
🎉 Socket.IO server is ready and connected to Hono!
```

### 2. Health Check Endpoint

Visit `http://localhost:1284/health` to verify the server is running:

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "socketIo": "connected",
  "port": 1284
}
```

### 3. Client Connection Test

Run the test script to verify Socket.IO connections:

```bash
# Install dependencies
pnpm install

# Start the server
pnpm dev

# In another terminal, run the test
node test-socket.js
```

Expected output:

```
🧪 Testing Socket.IO connection...
✅ Health check response: { status: 'ok', ... }
✅ Successfully connected to Socket.IO server!
Socket ID: [socket-id]
✅ Room creation response: [response]
```

### 4. Real-time Connection Monitoring

When clients connect, you'll see:

```
✅ Socket.IO client connected: [socket-id]
🎯 Socket.IO connection established: [socket-id]
✅ Authentication successful for socket [socket-id]
```

When clients disconnect:

```
❌ Socket.IO client disconnected: [socket-id]
```

## Troubleshooting

### If Socket.IO isn't connecting:

1. **Check port availability**: Ensure port 1284 is not in use
2. **Verify CORS**: Check that your frontend URL is in the allowed origins
3. **Authentication**: Ensure clients send the correct auth token (`demo-token`)
4. **Network**: Verify the server is accessible from your client

### Common Issues:

1. **CORS errors**: Add your frontend URL to `allowedOrigins` in `index.ts`
2. **Authentication failures**: Check that clients send `auth: { token: 'demo-token' }`
3. **Port conflicts**: The server will automatically try the next available port

## Integration Points

Your Socket.IO server is connected to Hono through:

```typescript
// In index.ts
const server = serve({
  fetch: app.fetch,
  port: currentPort,
  hostname: "0.0.0.0",
});

const io = new SocketIOServer(server);
socketIoConnection(io);
```

This ensures both HTTP and WebSocket traffic are handled by the same server instance.
